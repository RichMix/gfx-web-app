import React, { Dispatch, SetStateAction } from 'react'
import { MintLayout, createMintToInstruction } from '@solana/spl-token-v2'
import { Keypair, Connection, SystemProgram, TransactionInstruction, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { WalletContextState } from '@solana/wallet-adapter-react'
import {
  AR_SOL_HOLDER_ID,
  toPublicKey,
  StringPublicKey,
  findProgramAddress,
  Data,
  createMasterEdition,
  createMetadata,
  createAssociatedTokenAccountInstruction,
  createMint,
  programIds
} from '../index'
import { IMetadataContext } from '../../types/nft_details.d'
import { updateMetadata } from './metadata'
import { sendTransactionWithRetry } from '../transactions'
import crypto from 'crypto'
import BN from 'bn.js'
import { calculate } from '@metaplex/arweave-cost'

export const LAMPORT_MULTIPLIER = LAMPORTS_PER_SOL

export const ARWEAVE_UPLOAD_ENDPOINT = 'https://us-central1-metaplex-studios.cloudfunctions.net/uploadFile'

export async function getAssetCostToStore(files: { size: number }[]): Promise<number> {
  const sizes = files.map((f) => f.size)
  const result = await calculate(sizes)

  const lamps = LAMPORTS_PER_SOL * result.solana
  return parseFloat(lamps.toFixed(0))
}

const RESERVED_TXN_MANIFEST = 'manifest.json'
const RESERVED_METADATA = 'metadata.json'

interface IArweaveResult {
  error?: string
  messages?: Array<{
    filename: string
    status: 'success' | 'fail'
    transactionId?: string
    error?: string
  }>
}

const uploadToArweave = async (data: FormData): Promise<IArweaveResult> => {
  const resp = await fetch(ARWEAVE_UPLOAD_ENDPOINT, {
    method: 'POST',
    // @ts-ignore
    body: data
  })

  if (!resp.ok) {
    return Promise.reject(new Error('Unable to upload the artwork to Arweave. Please wait and then try again.'))
  }

  const result: IArweaveResult = await resp.json()

  if (result.error) {
    return Promise.reject(new Error(result.error))
  }

  return result
}

export const mintNFT = async (
  connection: Connection,
  wallet: WalletContextState | undefined,
  endpoint: string,
  files: File[],
  metadata: IMetadataContext,
  progressCallback: Dispatch<SetStateAction<number>>,
  maxSupply?: number
): Promise<{
  metadataAccount: StringPublicKey
} | void> => {
  if (!wallet?.publicKey) return

  const metadataContent = {
    name: metadata.name,
    symbol: metadata.symbol,
    description: metadata.description,
    seller_fee_basis_points: metadata.sellerFeeBasisPoints,
    image: metadata.image,
    animation_url: metadata.animation_url,
    attributes: metadata.attributes,
    external_url: metadata.external_url,
    properties: {
      ...metadata.properties,
      creators: metadata.creators?.map((creator) => ({
        address: creator.address,
        share: creator.share
      }))
    }
  }

  const realFiles: File[] = [...files, new File([JSON.stringify(metadataContent)], RESERVED_METADATA)]

  const { instructions: pushInstructions, signers: pushSigners } = await prepPayForFilesTxn(
    wallet,
    realFiles,
    metadata
  )

  progressCallback(1)

  // Allocate memory for the account
  const mintRent = await connection.getMinimumBalanceForRentExemption(MintLayout.span)
  // const accountRent = await connection.getMinimumBalanceForRentExemption(
  //   AccountLayout.span,
  // );

  // This owner is a temporary signer and owner of metadata we use to circumvent requesting signing
  // twice post Arweave. We store in an account (payer) and use it post-Arweave to update MD with new link
  // then give control back to the user.
  // const payer = new Account();
  const payerPublicKey = wallet.publicKey.toBase58()
  const instructions: TransactionInstruction[] = [...pushInstructions]
  const signers: Keypair[] = [...pushSigners]

  // This is only temporarily owned by wallet...transferred to program by createMasterEdition below
  const mintKey = createMint(
    instructions,
    wallet.publicKey,
    mintRent,
    0,
    // Some weird bug with phantom where it's public key doesnt mesh with data encode wellff
    toPublicKey(payerPublicKey),
    toPublicKey(payerPublicKey),
    signers
  ).toBase58()

  const recipientKey = (
    await findProgramAddress(
      [wallet.publicKey.toBuffer(), programIds().token.toBuffer(), toPublicKey(mintKey).toBuffer()],
      programIds().associatedToken
    )
  )[0]

  createAssociatedTokenAccountInstruction(
    instructions,
    toPublicKey(recipientKey),
    wallet.publicKey,
    wallet.publicKey,
    toPublicKey(mintKey)
  )

  const metadataAccount = await createMetadata(
    new Data({
      symbol: metadata.symbol,
      name: metadata.name,
      uri: ' '.repeat(64), // size of url for arweave
      sellerFeeBasisPoints: metadata.sellerFeeBasisPoints,
      creators: metadata.creators
    }),
    payerPublicKey,
    mintKey,
    payerPublicKey,
    instructions,
    wallet.publicKey.toBase58()
  )
  progressCallback(2)

  // TODO: enable when using payer account to avoid 2nd popup

  const { txid } = await sendTransactionWithRetry(connection, wallet, instructions, signers, 'single')
  progressCallback(3)

  try {
    await connection.confirmTransaction(txid, 'max')
    progressCallback(4)
  } catch {
    // ignore
  }

  // Force wait for max confirmations
  await connection.getParsedConfirmedTransaction(txid, 'confirmed')

  progressCallback(5)

  // this means we're done getting AR txn setup. Ship it off to ARWeave!
  const data = new FormData()
  data.append('transaction', txid)
  data.append('env', endpoint)

  const tags = realFiles.reduce((acc: Record<string, Array<{ name: string; value: string }>>, f) => {
    acc[f.name] = [{ name: 'mint', value: mintKey }]
    return acc
  }, {})
  data.append('tags', JSON.stringify(tags))
  realFiles.map((f) => data.append('file[]', f))

  // TODO: convert to absolute file name for image

  const result: IArweaveResult = await uploadToArweave(data)
  progressCallback(6)

  const metadataFile = result.messages?.find((m) => m.filename === RESERVED_TXN_MANIFEST)
  if (metadataFile?.transactionId && wallet.publicKey) {
    const updateInstructions: TransactionInstruction[] = []

    // TODO: connect to testnet arweave
    const arweaveLink = `https://arweave.net/${metadataFile.transactionId}`
    await updateMetadata(
      new Data({
        name: metadata.name,
        symbol: metadata.symbol,
        uri: arweaveLink,
        creators: metadata.creators,
        sellerFeeBasisPoints: metadata.sellerFeeBasisPoints
      }),
      undefined,
      undefined,
      mintKey,
      payerPublicKey,
      updateInstructions,
      metadataAccount
    )

    updateInstructions.push(
      createMintToInstruction(toPublicKey(mintKey), toPublicKey(recipientKey), toPublicKey(payerPublicKey), 1, [])
    )

    progressCallback(7)
    // In this instruction, mint authority will be removed from the main mint, while
    // minting authority will be maintained for the Printing mint (which we want.)
    await createMasterEdition(
      maxSupply !== undefined ? new BN(maxSupply) : undefined,
      mintKey,
      payerPublicKey,
      payerPublicKey,
      payerPublicKey,
      updateInstructions
    )

    progressCallback(8)

    console.log({
      message: 'Art created on Solana',
      description: (
        <a href={arweaveLink} target="_blank" rel="noopener noreferrer">
          Arweave Link
        </a>
      ),
      type: 'success'
    })

    // TODO: refund funds

    // send transfer back to user
  }
  // TODO:
  // 1. Jordan: --- upload file and metadata to storage API
  // 2. pay for storage by hashing files and attaching memo for each file

  return { metadataAccount }
}

export const prepPayForFilesTxn = async (
  wallet: WalletContextState,
  files: File[],
  metadata: any //eslint-disable-line
): Promise<{
  instructions: TransactionInstruction[]
  signers: Keypair[]
}> => {
  const memo = programIds().memo

  const instructions: TransactionInstruction[] = []
  const signers: Keypair[] = []

  if (wallet.publicKey) {
    const lamps = await getAssetCostToStore(files)

    instructions.push(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: AR_SOL_HOLDER_ID,
        lamports: lamps
      })
    )
  }

  for (let i = 0; i < files.length; i++) {
    const hashSum = crypto.createHash('sha256')
    hashSum.update(await files[i].text())
    const hex = hashSum.digest('hex')
    instructions.push(
      new TransactionInstruction({
        keys: [],
        programId: memo,
        data: Buffer.from(hex)
      })
    )
  }

  return {
    instructions,
    signers
  }
}

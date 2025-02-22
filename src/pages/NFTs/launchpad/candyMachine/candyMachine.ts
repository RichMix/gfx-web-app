import * as anchor from '@project-serum/anchor'

import {
  MintLayout,
  TOKEN_PROGRAM_ID,
  createMintToInstruction,
  createInitializeMintInstruction
} from '@solana/spl-token-v2'
import { SystemProgram, Transaction, SYSVAR_SLOT_HASHES_PUBKEY, NONCE_ACCOUNT_LENGTH } from '@solana/web3.js'
import { sendTransactions, sendTransactionsNonce, SequenceType } from './connection'
import { WalletContextState } from '@solana/wallet-adapter-react'

import {
  CIVIC,
  getAtaForMint,
  getNetworkExpire,
  getNetworkToken,
  SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID
} from './utils'

import {
  MAGIC_HAT_CREATOR,
  MAGIC_HAT_ID,
  MAGIC_HAT_PROGRAM_V2_ID,
  pdaSeed,
  pdaWhitelistSeed
} from '../customSC/config'

export const CANDY_MACHINE_PROGRAM = new anchor.web3.PublicKey('cndy3Z4yapfJBmL3ShUp5exZKqR3z33thTzeNMm2gRZ')

const TOKEN_METADATA_PROGRAM_ID = new anchor.web3.PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s')

interface CandyMachineState {
  authority: anchor.web3.PublicKey
  itemsAvailable: number
  itemsRedeemed: number
  itemsRemaining: number
  treasury: anchor.web3.PublicKey
  tokenMint: null | anchor.web3.PublicKey
  isSoldOut: boolean
  isActive: boolean
  isPresale: boolean
  isWhitelistOnly: boolean
  goLiveDate: anchor.BN
  price: anchor.BN
  gatekeeper: null | {
    expireOnUse: boolean
    gatekeeperNetwork: anchor.web3.PublicKey
  }
  endSettings: null | {
    number: anchor.BN
    endSettingType: any
  }
  whitelistMintSettings: null | {
    mode: any
    mint: anchor.web3.PublicKey
    presale: boolean
    discountPrice: null | anchor.BN
  }
  hiddenSettings: null | {
    name: string
    uri: string
    hash: Uint8Array
  }
  retainAuthority: boolean
}

export interface CandyMachineAccount {
  id: anchor.web3.PublicKey
  program: anchor.Program
  state: CandyMachineState
}

export const awaitTransactionSignatureConfirmation = async (
  txid: anchor.web3.TransactionSignature,
  timeout: number,
  connection: anchor.web3.Connection,
  queryStatus = false
): Promise<anchor.web3.SignatureStatus | null | void> => {
  let done = false
  let status: anchor.web3.SignatureStatus | null | void = {
    slot: 0,
    confirmations: 0,
    err: null
  }
  status = await new Promise((resolve, reject) => {
    setTimeout(() => {
      if (done) {
        return
      }
      done = true
      console.log('Rejecting for timeout...')
      reject({ timeout: true })
    }, timeout)
    ;(async () => {
      while (!done && queryStatus) {
        // eslint-disable-next-line no-loop-func
        ;(async () => {
          try {
            const signatureStatuses = await connection.getSignatureStatuses([txid])
            status = signatureStatuses && signatureStatuses.value[0]
            if (!done) {
              if (!status) {
                console.log('REST null result for', txid, status)
              } else if (status.err) {
                console.log('REST error for', txid, status)
                done = true
                reject(status.err)
              } else if (!status.confirmations) {
                console.log('REST no confirmations for', txid, status)
              } else {
                console.log('REST confirmation for', txid, status)
                done = true
                resolve(status)
              }
            }
          } catch (e) {
            if (!done) {
              console.log('REST connection error: txid', txid, e)
            }
          }
        })()
        await sleep(2000)
      }
    })()
  })

  //@ts-ignore

  done = true
  return status
}

const createAssociatedTokenAccountInstruction = (
  associatedTokenAddress: anchor.web3.PublicKey,
  payer: anchor.web3.PublicKey,
  walletAddress: anchor.web3.PublicKey,
  splTokenMintAddress: anchor.web3.PublicKey
) => {
  const keys = [
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: associatedTokenAddress, isSigner: false, isWritable: true },
    { pubkey: walletAddress, isSigner: false, isWritable: false },
    { pubkey: splTokenMintAddress, isSigner: false, isWritable: false },
    {
      pubkey: anchor.web3.SystemProgram.programId,
      isSigner: false,
      isWritable: false
    },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    {
      pubkey: anchor.web3.SYSVAR_RENT_PUBKEY,
      isSigner: false,
      isWritable: false
    }
  ]
  return new anchor.web3.TransactionInstruction({
    keys,
    programId: SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
    data: Buffer.from([])
  })
}

export const getCandyMachineState = async (
  anchorWallet: anchor.Wallet,
  candyMachineId: anchor.web3.PublicKey,
  connection: anchor.web3.Connection
): Promise<CandyMachineAccount> => {
  const provider = new anchor.Provider(connection, anchorWallet, {
    preflightCommitment: 'processed'
  })

  const idl = await anchor.Program.fetchIdl(CANDY_MACHINE_PROGRAM, provider)

  const program = new anchor.Program(idl, CANDY_MACHINE_PROGRAM, provider)

  const state: any = await program.account.candyMachine.fetch(candyMachineId)
  const itemsAvailable = state.data.itemsAvailable.toNumber()
  const itemsRedeemed = state.itemsRedeemed.toNumber()
  const itemsRemaining = itemsAvailable - itemsRedeemed

  return {
    id: candyMachineId,
    program,
    state: {
      authority: state.authority,
      itemsAvailable,
      itemsRedeemed,
      itemsRemaining,
      isSoldOut: itemsRemaining === 0,
      isActive: false,
      isPresale: false,
      isWhitelistOnly: false,
      goLiveDate: state.data.goLiveDate,
      treasury: state.wallet,
      tokenMint: state.tokenMint,
      gatekeeper: state.data.gatekeeper,
      endSettings: state.data.endSettings,
      whitelistMintSettings: state.data.whitelistMintSettings,
      hiddenSettings: state.data.hiddenSettings,
      price: state.data.price,
      retainAuthority: state.data.retainAuthority
    }
  }
}

const getMasterEdition = async (mint: anchor.web3.PublicKey): Promise<anchor.web3.PublicKey> =>
  (
    await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from('metadata'), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer(), Buffer.from('edition')],
      TOKEN_METADATA_PROGRAM_ID
    )
  )[0]

const getMetadata = async (mint: anchor.web3.PublicKey): Promise<anchor.web3.PublicKey> =>
  (
    await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from('metadata'), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
      TOKEN_METADATA_PROGRAM_ID
    )
  )[0]

export const getCandyMachineCreator = async (
  candyMachine: anchor.web3.PublicKey
): Promise<[anchor.web3.PublicKey, number]> =>
  await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from('candy_machine'), candyMachine.toBuffer()],
    CANDY_MACHINE_PROGRAM
  )

export const getCollectionPDA = async (
  candyMachineAddress: anchor.web3.PublicKey
): Promise<[anchor.web3.PublicKey, number]> =>
  await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from('collection'), candyMachineAddress.toBuffer()],
    CANDY_MACHINE_PROGRAM
  )

export interface CollectionData {
  mint: anchor.web3.PublicKey
  candyMachine: anchor.web3.PublicKey
}

export const getCollectionAuthorityRecordPDA = async (
  mint: anchor.web3.PublicKey,
  newAuthority: anchor.web3.PublicKey
): Promise<anchor.web3.PublicKey> =>
  (
    await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from('metadata'),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mint.toBuffer(),
        Buffer.from('collection_authority'),
        newAuthority.toBuffer()
      ],
      TOKEN_METADATA_PROGRAM_ID
    )
  )[0]

export type SetupState = {
  mint: anchor.web3.Keypair
  userTokenAccount: anchor.web3.PublicKey
  transaction: string
}

export const createAccountsForMint = async (
  candyMachine: CandyMachineAccount,
  payer: anchor.web3.PublicKey
): Promise<SetupState> => {
  const mint = anchor.web3.Keypair.generate()
  const userTokenAccountAddress = (await getAtaForMint(mint.publicKey, payer))[0]

  const signers: anchor.web3.Keypair[] = [mint]
  const instructions = [
    anchor.web3.SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: mint.publicKey,
      space: MintLayout.span,
      lamports: await candyMachine.program.provider.connection.getMinimumBalanceForRentExemption(MintLayout.span),
      programId: TOKEN_PROGRAM_ID
    }),
    createInitializeMintInstruction(mint.publicKey, 0, payer, payer, TOKEN_PROGRAM_ID),
    createAssociatedTokenAccountInstruction(userTokenAccountAddress, payer, payer, mint.publicKey),
    createMintToInstruction(mint.publicKey, userTokenAccountAddress, payer, 1)
  ]

  return {
    mint: mint,
    userTokenAccount: userTokenAccountAddress,
    transaction: (
      await sendTransactions(
        candyMachine.program.provider.connection,
        candyMachine.program.provider.wallet as WalletContextState, //eslint-disable-line
        [instructions],
        [signers],
        SequenceType.StopOnFailure,
        'singleGossip',
        () => null,
        () => false,
        undefined,
        [],
        []
      )
    ).txs[0].txid
  }
}

type MintResult = {
  mintTxId: string
  metadataKey: anchor.web3.PublicKey
}

export const mintOneToken = async (
  candyMachine: CandyMachineAccount,
  payer: anchor.web3.PublicKey,
  beforeTransactions: Transaction[] = [],
  afterTransactions: Transaction[] = [],
  setupState?: SetupState
): Promise<MintResult | null> => {
  const mint = setupState?.mint ?? anchor.web3.Keypair.generate()
  const userTokenAccountAddress = (await getAtaForMint(mint.publicKey, payer))[0]

  const userPayingAccountAddress = candyMachine.state.tokenMint
    ? (await getAtaForMint(candyMachine.state.tokenMint, payer))[0]
    : payer

  const candyMachineAddress = candyMachine.id
  const remainingAccounts = []
  const instructions = []
  const signers: anchor.web3.Keypair[] = []
  if (!setupState) {
    signers.push(mint)
    instructions.push(
      ...[
        anchor.web3.SystemProgram.createAccount({
          fromPubkey: payer,
          newAccountPubkey: mint.publicKey,
          space: MintLayout.span,
          lamports: await candyMachine.program.provider.connection.getMinimumBalanceForRentExemption(
            MintLayout.span
          ),
          programId: TOKEN_PROGRAM_ID
        }),
        createInitializeMintInstruction(mint.publicKey, 0, payer, payer),
        createAssociatedTokenAccountInstruction(userTokenAccountAddress, payer, payer, mint.publicKey),
        createMintToInstruction(mint.publicKey, userTokenAccountAddress, payer, 1)
      ]
    )
  }

  if (candyMachine.state.gatekeeper) {
    remainingAccounts.push({
      pubkey: (await getNetworkToken(payer, candyMachine.state.gatekeeper.gatekeeperNetwork))[0],
      isWritable: true,
      isSigner: false
    })

    if (candyMachine.state.gatekeeper.expireOnUse) {
      remainingAccounts.push({
        pubkey: CIVIC,
        isWritable: false,
        isSigner: false
      })
      remainingAccounts.push({
        pubkey: (await getNetworkExpire(candyMachine.state.gatekeeper.gatekeeperNetwork))[0],
        isWritable: false,
        isSigner: false
      })
    }
  }
  if (candyMachine.state.whitelistMintSettings) {
    const mint = new anchor.web3.PublicKey(candyMachine.state.whitelistMintSettings.mint)

    const whitelistToken = (await getAtaForMint(mint, payer))[0]
    remainingAccounts.push({
      pubkey: whitelistToken,
      isWritable: true,
      isSigner: false
    })

    if (candyMachine.state.whitelistMintSettings.mode.burnEveryTime) {
      remainingAccounts.push({
        pubkey: mint,
        isWritable: true,
        isSigner: false
      })
      remainingAccounts.push({
        pubkey: payer,
        isWritable: false,
        isSigner: true
      })
    }
  }

  if (candyMachine.state.tokenMint) {
    remainingAccounts.push({
      pubkey: userPayingAccountAddress,
      isWritable: true,
      isSigner: false
    })
    remainingAccounts.push({
      pubkey: payer,
      isWritable: false,
      isSigner: true
    })
  }
  const metadataAddress = await getMetadata(mint.publicKey)
  const masterEdition = await getMasterEdition(mint.publicKey)

  const [candyMachineCreator, creatorBump] = await getCandyMachineCreator(candyMachineAddress)

  console.log(remainingAccounts.map((rm) => rm.pubkey.toBase58()))
  instructions.push(
    await candyMachine.program.instruction.mintNft(creatorBump, {
      accounts: {
        candyMachine: candyMachineAddress,
        candyMachineCreator,
        payer: payer,
        wallet: candyMachine.state.treasury,
        mint: mint.publicKey,
        metadata: metadataAddress,
        masterEdition,
        mintAuthority: payer,
        updateAuthority: payer,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        recentBlockhashes: SYSVAR_SLOT_HASHES_PUBKEY,
        instructionSysvarAccount: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY
      },
      remainingAccounts: remainingAccounts.length > 0 ? remainingAccounts : undefined
    })
  )

  const [collectionPDA] = await getCollectionPDA(candyMachineAddress)
  const collectionPDAAccount = await candyMachine.program.provider.connection.getAccountInfo(collectionPDA)

  if (collectionPDAAccount && candyMachine.state.retainAuthority) {
    try {
      const collectionData = (await candyMachine.program.account.collectionPda.fetch(
        collectionPDA
      )) as CollectionData
      console.log(collectionData)
      const collectionMint = collectionData.mint
      const collectionAuthorityRecord = await getCollectionAuthorityRecordPDA(collectionMint, collectionPDA)
      console.log(collectionMint)
      if (collectionMint) {
        const collectionMetadata = await getMetadata(collectionMint)
        const collectionMasterEdition = await getMasterEdition(collectionMint)
        instructions.push(
          await candyMachine.program.instruction.setCollectionDuringMint({
            accounts: {
              candyMachine: candyMachineAddress,
              metadata: metadataAddress,
              payer: payer,
              collectionPda: collectionPDA,
              tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
              instructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
              collectionMint,
              collectionMetadata,
              collectionMasterEdition,
              authority: candyMachine.state.authority,
              collectionAuthorityRecord
            }
          })
        )
      }
    } catch (error) {
      console.error(error)
    }
  }

  const instructionsMatrix = [instructions]
  const signersMatrix = [signers]
  try {
    const txns = (
      await sendTransactions(
        candyMachine.program.provider.connection,
        candyMachine.program.provider.wallet as WalletContextState, //eslint-disable-line
        instructionsMatrix,
        signersMatrix,
        SequenceType.StopOnFailure,
        'singleGossip',
        () => null,
        () => false,
        undefined,
        beforeTransactions,
        afterTransactions
      )
    ).txs.map((t) => t.txid)
    const mintTxn = txns[0]
    return {
      mintTxId: mintTxn,
      metadataKey: metadataAddress
    }
  } catch (e) {
    console.log(e)
  }
  return null
}

export const mintOneTokenNonce = async (
  candyMachine: CandyMachineAccount,
  payer: anchor.web3.PublicKey,
  beforeTransactions: Transaction[] = [],
  afterTransactions: Transaction[] = [],
  setupState: SetupState,
  nonceAccount: anchor.web3.Keypair,
  collectionId: string,
  walletAddress: string
): Promise<{
  number: number
  txs: {
    txid: string
    slot: number
  }[]
}> => {
  const mint = setupState?.mint

  const userPayingAccountAddress = candyMachine.state.tokenMint
    ? (await getAtaForMint(candyMachine.state.tokenMint, payer))[0]
    : payer

  const candyMachineAddress = candyMachine.id
  const remainingAccounts = []
  const instructions = []
  const signers: anchor.web3.Keypair[] = []

  if (candyMachine.state.gatekeeper) {
    remainingAccounts.push({
      pubkey: (await getNetworkToken(payer, candyMachine.state.gatekeeper.gatekeeperNetwork))[0],
      isWritable: true,
      isSigner: false
    })

    if (candyMachine.state.gatekeeper.expireOnUse) {
      remainingAccounts.push({
        pubkey: CIVIC,
        isWritable: false,
        isSigner: false
      })
      remainingAccounts.push({
        pubkey: (await getNetworkExpire(candyMachine.state.gatekeeper.gatekeeperNetwork))[0],
        isWritable: false,
        isSigner: false
      })
    }
  }
  if (candyMachine.state.whitelistMintSettings) {
    const mint = new anchor.web3.PublicKey(candyMachine.state.whitelistMintSettings.mint)

    const whitelistToken = (await getAtaForMint(mint, payer))[0]
    remainingAccounts.push({
      pubkey: whitelistToken,
      isWritable: true,
      isSigner: false
    })

    if (candyMachine.state.whitelistMintSettings.mode.burnEveryTime) {
      remainingAccounts.push({
        pubkey: mint,
        isWritable: true,
        isSigner: false
      })
      remainingAccounts.push({
        pubkey: payer,
        isWritable: false,
        isSigner: true
      })
    }
  }

  if (candyMachine.state.tokenMint) {
    remainingAccounts.push({
      pubkey: userPayingAccountAddress,
      isWritable: true,
      isSigner: false
    })
    remainingAccounts.push({
      pubkey: payer,
      isWritable: false,
      isSigner: true
    })
  }
  const metadataAddress = await getMetadata(mint.publicKey)
  const masterEdition = await getMasterEdition(mint.publicKey)

  const [candyMachineCreator, creatorBump] = await getCandyMachineCreator(candyMachineAddress)

  console.log(remainingAccounts.map((rm) => rm.pubkey.toBase58()))
  instructions.push(
    SystemProgram.nonceAdvance({
      noncePubkey: nonceAccount.publicKey,
      authorizedPubkey: payer
    })
  )

  instructions.push(
    await candyMachine.program.instruction.mintNft(creatorBump, {
      accounts: {
        candyMachine: candyMachineAddress,
        candyMachineCreator,
        payer: payer,
        wallet: candyMachine.state.treasury,
        mint: mint.publicKey,
        metadata: metadataAddress,
        masterEdition,
        mintAuthority: payer,
        updateAuthority: payer,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        recentBlockhashes: SYSVAR_SLOT_HASHES_PUBKEY,
        instructionSysvarAccount: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY
      },
      remainingAccounts: remainingAccounts.length > 0 ? remainingAccounts : undefined
    })
  )

  const [collectionPDA] = await getCollectionPDA(candyMachineAddress)
  const collectionPDAAccount = await candyMachine.program.provider.connection.getAccountInfo(collectionPDA)

  if (collectionPDAAccount && candyMachine.state.retainAuthority) {
    try {
      const collectionData = (await candyMachine.program.account.collectionPda.fetch(
        collectionPDA
      )) as CollectionData
      console.log(collectionData)
      const collectionMint = collectionData.mint
      const collectionAuthorityRecord = await getCollectionAuthorityRecordPDA(collectionMint, collectionPDA)
      console.log(collectionMint)
      if (collectionMint) {
        const collectionMetadata = await getMetadata(collectionMint)
        const collectionMasterEdition = await getMasterEdition(collectionMint)
        instructions.push(
          await candyMachine.program.instruction.setCollectionDuringMint({
            accounts: {
              candyMachine: candyMachineAddress,
              metadata: metadataAddress,
              payer: payer,
              collectionPda: collectionPDA,
              tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
              instructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
              collectionMint,
              collectionMetadata,
              collectionMasterEdition,
              authority: candyMachine.state.authority,
              collectionAuthorityRecord
            }
          })
        )
      }
    } catch (error) {
      console.error(error)
    }
  }

  const instructionsMatrix = [instructions]
  const signersMatrix = [signers]
  try {
    const response = await sendTransactionsNonce(
      candyMachine.program.provider.connection,
      candyMachine.program.provider.wallet as WalletContextState, //eslint-disable-line
      instructionsMatrix,
      signersMatrix,
      beforeTransactions,
      afterTransactions,
      nonceAccount.publicKey,
      collectionId,
      walletAddress
    )
    return response
  } catch (e) {
    console.log(e)
    return null
  }
}

export const mintOneTokenCustom = async (
  candyMachine: CandyMachineAccount,
  payer: anchor.web3.PublicKey,
  beforeTransactions: Transaction[] = [],
  afterTransactions: Transaction[] = [],
  setupState?: SetupState
): Promise<MintResult | null> => {
  const mint = setupState?.mint ?? anchor.web3.Keypair.generate()
  const userTokenAccountAddress = (await getAtaForMint(mint.publicKey, payer))[0]

  const userPayingAccountAddress = candyMachine.state.tokenMint
    ? (await getAtaForMint(candyMachine.state.tokenMint, payer))[0]
    : payer

  const candyMachineAddress = candyMachine.id
  const remainingAccounts = []
  const instructions = []
  const signers: anchor.web3.Keypair[] = []
  if (!setupState) {
    signers.push(mint)
    instructions.push(
      ...[
        anchor.web3.SystemProgram.createAccount({
          fromPubkey: payer,
          newAccountPubkey: mint.publicKey,
          space: MintLayout.span,
          lamports: await candyMachine.program.provider.connection.getMinimumBalanceForRentExemption(
            MintLayout.span
          ),
          programId: TOKEN_PROGRAM_ID
        }),
        createInitializeMintInstruction(mint.publicKey, 0, payer, payer),
        createAssociatedTokenAccountInstruction(userTokenAccountAddress, payer, payer, mint.publicKey),
        createMintToInstruction(mint.publicKey, userTokenAccountAddress, payer, 1)
      ]
    )
  }

  if (candyMachine.state.gatekeeper) {
    remainingAccounts.push({
      pubkey: (await getNetworkToken(payer, candyMachine.state.gatekeeper.gatekeeperNetwork))[0],
      isWritable: true,
      isSigner: false
    })

    if (candyMachine.state.gatekeeper.expireOnUse) {
      remainingAccounts.push({
        pubkey: CIVIC,
        isWritable: false,
        isSigner: false
      })
      remainingAccounts.push({
        pubkey: (await getNetworkExpire(candyMachine.state.gatekeeper.gatekeeperNetwork))[0],
        isWritable: false,
        isSigner: false
      })
    }
  }
  if (candyMachine.state.whitelistMintSettings) {
    const mint = new anchor.web3.PublicKey(candyMachine.state.whitelistMintSettings.mint)

    const whitelistToken = (await getAtaForMint(mint, payer))[0]
    remainingAccounts.push({
      pubkey: whitelistToken,
      isWritable: true,
      isSigner: false
    })

    if (candyMachine.state.whitelistMintSettings.mode.burnEveryTime) {
      remainingAccounts.push({
        pubkey: mint,
        isWritable: true,
        isSigner: false
      })
      remainingAccounts.push({
        pubkey: payer,
        isWritable: false,
        isSigner: true
      })
    }
  }

  if (candyMachine.state.tokenMint) {
    remainingAccounts.push({
      pubkey: userPayingAccountAddress,
      isWritable: true,
      isSigner: false
    })
    remainingAccounts.push({
      pubkey: payer,
      isWritable: false,
      isSigner: true
    })
  }
  const metadataAddress = await getMetadata(mint.publicKey)
  const masterEdition = await getMasterEdition(mint.publicKey)

  const [magicHatCreator, magicHatCreatorBump] = await getMagicHatCreator(MAGIC_HAT_ID)
  instructions.push(
    await candyMachine.program.instruction.mintNft(magicHatCreatorBump, {
      accounts: {
        magicHat: MAGIC_HAT_ID,
        magicHatCreator,
        payer: payer,
        wallet: candyMachine.state.treasury,
        mint: mint.publicKey,
        metadata: metadataAddress,
        masterEdition,
        mintAuthority: payer,
        updateAuthority: payer,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        recentBlockhashes: SYSVAR_SLOT_HASHES_PUBKEY,
        instructionSysvarAccount: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY
      },
      remainingAccounts: remainingAccounts.length > 0 ? remainingAccounts : undefined
    })
  )

  const [collectionPDA] = await getCollectionPDA(candyMachineAddress)
  const collectionPDAAccount = await candyMachine.program.provider.connection.getAccountInfo(collectionPDA)

  if (collectionPDAAccount && candyMachine.state.retainAuthority) {
    try {
      const collectionData = (await candyMachine.program.account.collectionPda.fetch(
        collectionPDA
      )) as CollectionData
      const collectionMint = collectionData.mint
      const collectionAuthorityRecord = await getCollectionAuthorityRecordPDA(collectionMint, collectionPDA)
      if (collectionMint) {
        const collectionMetadata = await getMetadata(collectionMint)
        const collectionMasterEdition = await getMasterEdition(collectionMint)
        instructions.push(
          await candyMachine.program.instruction.setCollectionDuringMint({
            accounts: {
              candyMachine: candyMachineAddress,
              metadata: metadataAddress,
              payer: payer,
              collectionPda: collectionPDA,
              tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
              instructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
              collectionMint,
              collectionMetadata,
              collectionMasterEdition,
              authority: candyMachine.state.authority,
              collectionAuthorityRecord
            }
          })
        )
      }
    } catch (error) {
      console.error(error)
    }
  }

  const instructionsMatrix = [instructions]
  const signersMatrix = [signers]
  try {
    const txns = (
      await sendTransactions(
        candyMachine.program.provider.connection,
        candyMachine.program.provider.wallet as WalletContextState,
        instructionsMatrix,
        signersMatrix,
        SequenceType.StopOnFailure,
        'singleGossip',
        () => null,
        () => false,
        undefined,
        beforeTransactions,
        afterTransactions
      )
    ).txs.map((t) => t.txid)
    const mintTxn = txns[0]
    return {
      mintTxId: mintTxn,
      metadataKey: metadataAddress
    }
  } catch (e) {
    console.log(e)
  }
  return null
}

export const mintOneTokenWhitelist = async (
  candyMachine: CandyMachineAccount,
  payer: anchor.web3.PublicKey,
  beforeTransactions: Transaction[] = [],
  afterTransactions: Transaction[] = [],
  setupState?: SetupState,
  wallet_pda?: anchor.web3.PublicKey
): Promise<MintResult | null> => {
  const mint = setupState?.mint ?? anchor.web3.Keypair.generate()
  const userTokenAccountAddress = (await getAtaForMint(mint.publicKey, payer))[0]

  const userPayingAccountAddress = candyMachine.state.tokenMint
    ? (await getAtaForMint(candyMachine.state.tokenMint, payer))[0]
    : payer

  const candyMachineAddress = candyMachine.id
  const remainingAccounts = []
  const instructions = []
  const signers: anchor.web3.Keypair[] = []
  if (!setupState) {
    signers.push(mint)
    instructions.push(
      ...[
        anchor.web3.SystemProgram.createAccount({
          fromPubkey: payer,
          newAccountPubkey: mint.publicKey,
          space: MintLayout.span,
          lamports: await candyMachine.program.provider.connection.getMinimumBalanceForRentExemption(
            MintLayout.span
          ),
          programId: TOKEN_PROGRAM_ID
        }),
        createInitializeMintInstruction(mint.publicKey, 0, payer, payer),
        createAssociatedTokenAccountInstruction(userTokenAccountAddress, payer, payer, mint.publicKey),
        createMintToInstruction(mint.publicKey, userTokenAccountAddress, payer, 1)
      ]
    )
  }

  if (candyMachine.state.gatekeeper) {
    remainingAccounts.push({
      pubkey: (await getNetworkToken(payer, candyMachine.state.gatekeeper.gatekeeperNetwork))[0],
      isWritable: true,
      isSigner: false
    })

    if (candyMachine.state.gatekeeper.expireOnUse) {
      remainingAccounts.push({
        pubkey: CIVIC,
        isWritable: false,
        isSigner: false
      })
      remainingAccounts.push({
        pubkey: (await getNetworkExpire(candyMachine.state.gatekeeper.gatekeeperNetwork))[0],
        isWritable: false,
        isSigner: false
      })
    }
  }
  if (candyMachine.state.whitelistMintSettings) {
    const mint = new anchor.web3.PublicKey(candyMachine.state.whitelistMintSettings.mint)

    const whitelistToken = (await getAtaForMint(mint, payer))[0]
    remainingAccounts.push({
      pubkey: whitelistToken,
      isWritable: true,
      isSigner: false
    })

    if (candyMachine.state.whitelistMintSettings.mode.burnEveryTime) {
      remainingAccounts.push({
        pubkey: mint,
        isWritable: true,
        isSigner: false
      })
      remainingAccounts.push({
        pubkey: payer,
        isWritable: false,
        isSigner: true
      })
    }
  }

  if (candyMachine.state.tokenMint) {
    remainingAccounts.push({
      pubkey: userPayingAccountAddress,
      isWritable: true,
      isSigner: false
    })
    remainingAccounts.push({
      pubkey: payer,
      isWritable: false,
      isSigner: true
    })
  }
  const metadataAddress = await getMetadata(mint.publicKey)
  const masterEdition = await getMasterEdition(mint.publicKey)

  const [magicHatCreator, magicHatCreatorBump] = await getMagicHatCreator(MAGIC_HAT_ID)
  instructions.push(
    await candyMachine.program.instruction.wlMintNft(magicHatCreatorBump, {
      accounts: {
        magicHat: MAGIC_HAT_ID,
        walletWhitelist: wallet_pda,
        magicHatCreator,
        whitelistedAddress: payer,
        wallet: candyMachine.state.treasury,
        metadata: metadataAddress,
        mint: mint.publicKey,
        mintAuthority: payer,
        updateAuthority: payer,
        masterEdition,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        recentBlockhashes: anchor.web3.SYSVAR_RECENT_BLOCKHASHES_PUBKEY,
        instructionSysvarAccount: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY
      },
      remainingAccounts: remainingAccounts.length > 0 ? remainingAccounts : undefined
    })
  )

  const [collectionPDA] = await getCollectionPDA(candyMachineAddress)
  const collectionPDAAccount = await candyMachine.program.provider.connection.getAccountInfo(collectionPDA)

  if (collectionPDAAccount && candyMachine.state.retainAuthority) {
    try {
      const collectionData = (await candyMachine.program.account.collectionPda.fetch(
        collectionPDA
      )) as CollectionData
      console.log(collectionData)
      const collectionMint = collectionData.mint
      const collectionAuthorityRecord = await getCollectionAuthorityRecordPDA(collectionMint, collectionPDA)
      console.log(collectionMint)
      if (collectionMint) {
        const collectionMetadata = await getMetadata(collectionMint)
        const collectionMasterEdition = await getMasterEdition(collectionMint)
        instructions.push(
          await candyMachine.program.instruction.setCollectionDuringMint({
            accounts: {
              candyMachine: candyMachineAddress,
              metadata: metadataAddress,
              payer: payer,
              collectionPda: collectionPDA,
              tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
              instructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
              collectionMint,
              collectionMetadata,
              collectionMasterEdition,
              authority: candyMachine.state.authority,
              collectionAuthorityRecord
            }
          })
        )
      }
    } catch (error) {
      console.error(error)
    }
  }

  const instructionsMatrix = [instructions]
  const signersMatrix = [signers]
  try {
    const txns = (
      await sendTransactions(
        candyMachine.program.provider.connection,
        candyMachine.program.provider.wallet as WalletContextState,
        instructionsMatrix,
        signersMatrix,
        SequenceType.StopOnFailure,
        'singleGossip',
        () => null,
        () => false,
        undefined,
        beforeTransactions,
        afterTransactions
      )
    ).txs.map((t) => t.txid)
    const mintTxn = txns[0]
    return {
      mintTxId: mintTxn,
      metadataKey: metadataAddress
    }
  } catch (e) {
    console.log(e)
  }
  return null
}

export const shortenAddress = (address: string, chars = 4): string =>
  `${address.slice(0, chars)}...${address.slice(-chars)}`

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

export const createAccountsForMintNonce = async (
  candyMachine: CandyMachineAccount,
  payer: anchor.web3.PublicKey,
  nonceAcc?: anchor.web3.Keypair
): Promise<SetupState> => {
  const mint = anchor.web3.Keypair.generate()
  const userTokenAccountAddress = (await getAtaForMint(mint.publicKey, payer))[0]

  const signers: anchor.web3.Keypair[] = [mint]
  const instructions = [
    anchor.web3.SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: mint.publicKey,
      space: MintLayout.span,
      lamports: await candyMachine.program.provider.connection.getMinimumBalanceForRentExemption(MintLayout.span),
      programId: TOKEN_PROGRAM_ID
    }),
    createInitializeMintInstruction(mint.publicKey, 0, payer, payer),
    createAssociatedTokenAccountInstruction(userTokenAccountAddress, payer, payer, mint.publicKey),
    createMintToInstruction(mint.publicKey, userTokenAccountAddress, payer, 1)
  ]

  instructions.push(
    SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: nonceAcc.publicKey,
      lamports: await candyMachine.program.provider.connection.getMinimumBalanceForRentExemption(
        NONCE_ACCOUNT_LENGTH
      ),
      space: NONCE_ACCOUNT_LENGTH,
      programId: SystemProgram.programId
    })
  )

  instructions.push(
    SystemProgram.nonceInitialize({
      noncePubkey: nonceAcc.publicKey, // nonce account pubkey
      authorizedPubkey: payer // nonce account authority (for advance and close)
    })
  )
  signers.push(nonceAcc)
  return {
    mint: mint,
    userTokenAccount: userTokenAccountAddress,
    transaction: (
      await sendTransactions(
        candyMachine.program.provider.connection,
        candyMachine.program.provider.wallet as WalletContextState,
        [instructions],
        [signers],
        SequenceType.StopOnFailure,
        'singleGossip',
        () => {
          //empty function should be filled up or removed please
        },
        () => false,
        undefined,
        [],
        []
      )
    ).txs[0].txid
  }
}

export const getMagicHatCreator = async (
  magicHat: anchor.web3.PublicKey
): Promise<[anchor.web3.PublicKey, number]> =>
  await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from('magic_hat'), magicHat.toBuffer()],
    MAGIC_HAT_PROGRAM_V2_ID
  )

export const getPublicWalletWhitelistPda = async (
  payer: anchor.web3.PublicKey
): Promise<[anchor.web3.PublicKey, number]> =>
  await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from(pdaSeed), payer?.toBuffer()],
    MAGIC_HAT_PROGRAM_V2_ID
  )

export const getWalletWhitelistPda = async (
  payer: anchor.web3.PublicKey
): Promise<[anchor.web3.PublicKey, number]> =>
  await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from(pdaSeed), payer?.toBuffer(), MAGIC_HAT_CREATOR.toBuffer()],
    MAGIC_HAT_PROGRAM_V2_ID
  )

export const getWhitelistConfigPda = async (
  payer: anchor.web3.PublicKey
): Promise<[anchor.web3.PublicKey, number]> =>
  await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from(pdaWhitelistSeed), payer.toBuffer()],
    MAGIC_HAT_PROGRAM_V2_ID
  )

//eslint-disable-next-line
export const getWhitelistInfo = async (candyMachine: any, payer: anchor.web3.PublicKey): Promise<any> => {
  const whitelist_account = await getWalletWhitelistPda(payer)
  try {
    const whitelist_account_info = await candyMachine.account.walletWhitelist.fetch(whitelist_account[0])
    return whitelist_account_info
  } catch (e) {
    return null
  }
}

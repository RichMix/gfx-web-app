import React, { useState, useEffect, useCallback } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useHistory } from 'react-router-dom'
import isEmpty from 'lodash/isEmpty'
import styled from 'styled-components'

import { MainText } from '../../../styles'
import InfoInput from './InfoInput'
import { Categories } from '../../../components'
import PreviewImage from './PreviewImage'
import { UploadCustom } from './UploadCustom'
import MintPaymentConfirmation from './MintPaymentConfirmation'
import UploadProgress from './UploadProgress'
import AddAttribute from './AddAttribute'
import RoyaltiesStep from './RoyaltiesStep'
import { useDarkMode, useNFTDetails, useConnectionConfig } from '../../../context'
import { mintNFT, MetadataCategory, ENDPOINTS } from '../../../web3'
import { notify } from '../../../utils'
import { ButtonWrapper } from '../NFTButton'

//#region styles
const UPLOAD_CONTENT = styled.div`
  height: 100%;
  display: flex;
  flex-direction: row;
  padding-top: ${({ theme }) => theme.margin(5)};
  padding-bottom: ${({ theme }) => theme.margin(3)};
  padding-right: ${({ theme }) => theme.margin(6)};
  padding-left: ${({ theme }) => theme.margin(8)};

  .upload-NFT-back-icon {
    transform: rotate(90deg);
    width: 30px;
    height: 30px;
    filter: ${({ theme }) => theme.filterBackIcon};
    cursor: pointer;
    margin-right: ${({ theme }) => theme.margin(5)};
    margin-left: 0;
    margin-top: ${({ theme }) => theme.margin(1)};
  }
`

const UPLOAD_FIELD_CONTAINER = styled.div`
  display: flex;
  flex: 1;
  flex-direction: row;
  height: 100%;
`
const CONTAINER = styled.div`
  position: absolute;
  top: 0px;
  right: 0;
  bottom: 0;
  left: 0;
  background: #1e1e1e;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
`
const UPLOAD_INFO_CONTAINER = styled.div`
  display: flex;
  width: 57%;
  flex-direction: column;
  justify-content: space-between;
  margin-right: ${({ theme }) => theme.margin(4)};
`

const PREVIEW_UPLOAD_CONTAINER = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
`

const SECTION_TITLE = MainText(styled.div`
  font-size: 20px;
  font-weight: 600;
  color: ${({ theme }) => theme.text7} !important;
  text-align: left;
  margin-bottom: ${({ theme }) => theme.margin(1)};
`)

const SUB_TITLE = MainText(styled.div`
  font-size: 17px;
  font-weight: 600;
  color: ${({ theme }) => theme.text8} !important;
  text-align: left;
  margin-top: ${({ theme }) => theme.margin(0.5)};
  margin-bottom: ${({ theme }) => theme.margin(1)};
`)

const INPUT_SECTION = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`

const SPACE = styled.div`
  width: ${({ theme }) => theme.margin(6)};
`

const BUTTON_SECTION = styled.div`
  display: flex;
  justify-content: flex-end;
`

const FLAT_BUTTON = styled.button`
  height: 60px;
  width: 200px;
  padding: ${({ theme }) => `${theme.margin(2)} ${theme.margin(6)}`};
  text-align: center;
  color: ${({ theme }) => theme.white};
  background: transparent;
  margin-top: ${({ theme }) => theme.margin(5)};
  margin-right: ${({ theme }) => theme.margin(2)};
  border: none;
  ${({ theme }) => theme.roundedBorders};
  cursor: pointer;
`

const NEXT_BUTTON = styled.button`
  height: 60px;
  width: 245px;
  text-align: center;
  border: none;
  cursor: pointer;
  color: white;
  padding: ${({ theme }) => `${theme.margin(2)} ${theme.margin(6)}`};
  background-color: ${({ theme }) => theme.secondary5};
  margin-top: ${({ theme }) => theme.margin(1)};
  ${({ theme }) => theme.roundedBorders};

  &:disabled {
    background-color: #7d7d7d;
  }
`

const INFO_SECTION = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`

const STYLED_PROPERTY_BLOCK = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  border-radius: 15px;
  background-color: ${({ theme }) => theme.propertyBg};
  padding: ${({ theme }) => theme.margin(1.5)};
  padding-bottom: 0px;
  max-height: 162px;
  overflow-y: scroll;
  overflow-x: hidden;
  min-height: 65px;

  .property-item {
    width: 100px;
    height: 40px;
    padding: 2px ${({ theme }) => theme.margin(1)};
    border-radius: 10px;
    background-color: ${({ theme }) => theme.propertyItemBg};
    position: relative;
    margin-right: ${({ theme }) => theme.margin(1)};
    margin-bottom: ${({ theme }) => theme.margin(1)};
    .type {
      font-family: Montserrat;
      font-size: 11px;
      font-weight: 500;
      color: ${({ theme }) => theme.typePropertyColor};
      text-align: left;
    }
    .name {
      font-family: Montserrat;
      font-size: 12px;
      font-weight: 600;
      color: #fff;
      text-align: left;
    }
    .close-btn {
      width: 18px;
      height: 18px;
      position: absolute;
      top: -6px;
      right: -6px;
      cursor: pointer;
      img {
        display: block;
        width: 100%;
        height: auto;
      }
      &.lite {
        background: #2a2a2a;
        padding: 5px;
        border-radius: 50%;
      }
    }
  }
  ${({ theme }) => theme.customScrollBar('4px')};
`
const SELECTION_SECTION = styled.div`
  text-align: left;
  flex-grow: 1;
`

const SECTION_HEADING = MainText(styled.div`
  font-size: 17px;
  font-weight: 600;
  color: ${({ theme }) => theme.text8} !important;
  margin-bottom: ${({ theme }) => theme.margin(1)};
`)

const BUTTON_PLUS_WRAPPER = styled(ButtonWrapper)`
  width: 132px;
  height: 41px;
  justify-content: space-between;
  align-items: center;
  background-color: #9625ae;
  margin-bottom: ${({ theme }) => theme.margin(1.5)};

  img {
    height: 22px;
    width: 22px;
  }

  &.add-more {
    width: 100px;
  }

  &:disabled {
    background-color: #7d7d7d;
  }
`
//#endregion

export const UpLoadNFT = (): JSX.Element => {
  const { mode } = useDarkMode()
  const history = useHistory()
  const { nftMintingData, setNftMintingData } = useNFTDetails()
  const wallet = useWallet()
  const { connection } = useConnectionConfig()
  const [localFiles, setLocalFiles] = useState<any>()
  const [filesForUpload, setFilesForUpload] = useState<File[]>([])
  const [creatorModal, setCreatorModal] = useState(false)

  const [disabled, setDisabled] = useState(true)
  const [attributesModal, setAttributesModal] = useState(false)
  const [localAttributes, setLocalAttributes] = useState([])
  const [isConfirmingMintPrice, setIsConfirmingMintPrice] = useState(false)
  const [isMinting, setIsMinting] = useState(false)
  const [nftCreateProgress, setNFTcreateProgress] = useState<number>(0)
  const [congrats, setCongrats] = useState<boolean>(false)

  useEffect(() => {
    if (!wallet.publicKey) {
      notify({ message: 'Warning: wallet must be connected to mint an NFT', type: 'error' })
    }
  }, [wallet.publicKey])

  useEffect(() => {
    if (nftMintingData === undefined) {
      setNftInitState()
    }

    return () => {
      setLocalFiles(undefined)
      setFilesForUpload(undefined)
      setCongrats(false)
      setLocalAttributes([])
      setNftInitState()
    }
  }, [])

  useEffect(() => {
    // sets nft category automatically on new file set
    if (filesForUpload && filesForUpload[0]) {
      const file = filesForUpload[0].type.split('/')[0]
      const fileType = categoryOptions.find((opt) => opt.value.includes(file))
      if (fileType && nftMintingData.properties && nftMintingData.properties.category.length === 0)
        handleSelectCategory(fileType)
    }
    // toggle disabled state
    if (
      nftMintingData?.name &&
      nftMintingData?.description &&
      !isEmpty(filesForUpload) &&
      nftMintingData?.creators.length > 0
    ) {
      setDisabled(false)
    } else {
      setDisabled(true)
    }
  }, [nftMintingData, filesForUpload])

  useEffect(() => {
    setNftMintingData((prevData) => ({
      ...prevData,
      attributes: localAttributes.map((attr) => ({ trait_type: attr.trait_type, value: attr.value }))
    }))
  }, [setNftMintingData, localAttributes])

  const handleUploadNFT = () => {
    console.log('Confirm Price')
    setIsConfirmingMintPrice(true)
  }

  const handleConfirmMint = async () => {
    setIsMinting(true)
    setIsConfirmingMintPrice(false)
  }

  const mint = async () => {
    try {
      const res = await mintNFT(
        connection,
        wallet,
        ENDPOINTS[2].name,
        filesForUpload,
        nftMintingData,
        setNFTcreateProgress,
        nftMintingData.properties.maxSupply
      )
      //single or multiple (maxsupply)

      const _nft = await res
      if (_nft) {
        setCongrats(true)
        handleCompletedMint(_nft.metadataAccount, nftMintingData.name)
      }
    } catch (e: any) {
      notify({
        message: `${e.name}: ${e.message}`,
        type: 'error'
      })
    } finally {
      setNFTcreateProgress(0)
      setIsMinting(false)
    }
  }

  const handleCompletedMint = (metadataAccount: string, name: string) => {
    setCongrats(true)

    setTimeout(() => {
      history.push({
        pathname: '/NFTs/profile',
        state: { newlyMintedNFT: { name: name, metadataAccount: metadataAccount } }
      })
    }, 1500)
  }

  // title, desc
  const handleInputChange = useCallback(
    ({ e, id }) => {
      const { value } = e.target
      const temp = { ...nftMintingData }
      temp[id] = value
      setNftMintingData(temp)
    },
    [nftMintingData]
  )

  const handleAttributeListChange = (attributeList: any) => {
    setLocalAttributes(attributeList)
  }

  const handleRemoveAttribute = (id: string) =>
    setLocalAttributes((prevAttr) => prevAttr.filter((attr) => attr.id !== id))

  const handleSelectCategory = useCallback((selectedCategory) => {
    setNftMintingData((prevNFTData) => ({
      ...prevNFTData,
      properties: { ...prevNFTData.properties, category: selectedCategory.toLowerCase() }
    }))
  }, [])

  const handleSubmitCollection = useCallback(() => {
    setCreatorModal(false)
  }, [])

  const handleCancelCreatorData = () => {
    setNftMintingData((prev) => {
      console.log(prev)
      return prev
    })
    setCreatorModal(false)
  }

  const setNftInitState = () => {
    setNftMintingData({
      name: '',
      symbol: '',
      description: '',
      external_url: '',
      image: '',
      animation_url: undefined,
      attributes: undefined,
      sellerFeeBasisPoints: 0,
      creators: [],
      properties: {
        files: [],
        category: MetadataCategory.Image,
        maxSupply: 1
      }
    })
  }

  const categoryOptions = [
    { name: 'Audio', value: MetadataCategory.Audio, icon: 'music' },
    { name: 'Video', value: MetadataCategory.Video, icon: 'memes' },
    { name: 'Image', value: MetadataCategory.Image, icon: 'art' },
    { name: 'VR', value: MetadataCategory.VR, icon: 'metaverse' },
    { name: 'HTML', value: MetadataCategory.HTML, icon: 'domains' }
  ]

  return nftMintingData === undefined ? (
    <div>...Loading</div>
  ) : (
    <>
      <UPLOAD_CONTENT>
        <img
          className="upload-NFT-back-icon"
          src={`/img/assets/arrow.svg`}
          alt="back"
          onClick={() => history.push('/NFTs/create')}
        />
        <UPLOAD_FIELD_CONTAINER>
          <UPLOAD_INFO_CONTAINER>
            <div>
              <SECTION_TITLE>1. Upload your file</SECTION_TITLE>

              <UploadCustom
                setFilesForUpload={setFilesForUpload}
                setPreviewImage={setLocalFiles}
                nftMintingData={nftMintingData}
                setNftMintingData={setNftMintingData}
              />
            </div>
            <div>
              <SECTION_TITLE>2. Item settings</SECTION_TITLE>
              <INPUT_SECTION>
                <InfoInput
                  value={nftMintingData.name}
                  title="Name"
                  type={'input'}
                  maxLength={20}
                  placeholder="Name your item"
                  onChange={(e) => handleInputChange({ e, id: 'name' })}
                />
                <InfoInput
                  value={nftMintingData.description}
                  title="Description"
                  type={'textarea'}
                  maxLength={120}
                  placeholder="Describe your item"
                  onChange={(e) => handleInputChange({ e, id: 'description' })}
                />
              </INPUT_SECTION>
            </div>
            <INFO_SECTION>
              <SELECTION_SECTION>
                <SECTION_HEADING>Category</SECTION_HEADING>
                <Categories
                  categories={categoryOptions}
                  className="category"
                  onChange={handleSelectCategory}
                  style={{
                    width: 132,
                    height: 41,
                    justifyContent: 'space-around'
                  }}
                />
              </SELECTION_SECTION>
              <SELECTION_SECTION>
                <SECTION_HEADING>Creator Info</SECTION_HEADING>
                <BUTTON_PLUS_WRAPPER onClick={() => setCreatorModal(true)}>
                  <span>Creator Info</span>
                  <img src={`/img/assets/${nftMintingData.creators.length > 0 ? 'check' : 'plus'}.svg`} alt="Create" />
                </BUTTON_PLUS_WRAPPER>
              </SELECTION_SECTION>
            </INFO_SECTION>
            <div>
              <SUB_TITLE>Attributes</SUB_TITLE>
              <STYLED_PROPERTY_BLOCK>
                {localAttributes.length > 0 &&
                  localAttributes.map((item) => (
                    <div className="property-item" key={item.id}>
                      <div className="type">{item.trait_type}</div>
                      <div className="name">{item.value}</div>
                      <div className={`close-btn ${mode}`} onClick={() => handleRemoveAttribute(item.id)}>
                        <img
                          className="close-white-icon"
                          src={`/img/assets/${mode === 'dark' ? 'close-gray' : 'remove-property'}.svg`}
                          alt=""
                        />
                      </div>
                    </div>
                  ))}
                <BUTTON_PLUS_WRAPPER onClick={() => setAttributesModal(true)} className="add-more">
                  <span>Add</span>
                  <img src={`/img/assets/plus.svg`} alt="add" />
                </BUTTON_PLUS_WRAPPER>
              </STYLED_PROPERTY_BLOCK>
            </div>
          </UPLOAD_INFO_CONTAINER>
          <PREVIEW_UPLOAD_CONTAINER>
            <PreviewImage file={localFiles} />
            <BUTTON_SECTION>
              <NEXT_BUTTON onClick={handleUploadNFT} disabled={disabled}>
                <span>Next Steps</span>
              </NEXT_BUTTON>
            </BUTTON_SECTION>
          </PREVIEW_UPLOAD_CONTAINER>
        </UPLOAD_FIELD_CONTAINER>
      </UPLOAD_CONTENT>

      <RoyaltiesStep
        visible={creatorModal}
        setNftMintingData={setNftMintingData}
        nftMintingData={nftMintingData}
        handleSubmit={handleSubmitCollection}
        handleCancel={handleCancelCreatorData}
      />

      {attributesModal && (
        <AddAttribute
          visible={attributesModal}
          handleCancel={() => setAttributesModal(false)}
          handleOk={() => setAttributesModal(false)}
          attributeList={localAttributes}
          setAttributeList={handleAttributeListChange}
        />
      )}

      {isConfirmingMintPrice && (
        <MintPaymentConfirmation
          attributes={nftMintingData}
          files={filesForUpload}
          connection={connection}
          visible={isConfirmingMintPrice}
          confirm={() => handleConfirmMint()}
          returnToDetails={setIsConfirmingMintPrice}
        />
      )}

      {isMinting && <UploadProgress mint={mint} step={nftCreateProgress} />}

      {congrats && (
        <CONTAINER>
          <SECTION_TITLE>Congrats! Your NFT has succcessfully minted 🎉</SECTION_TITLE>
        </CONTAINER>
      )}
    </>
  )
}

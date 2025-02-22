import React, { FC, useEffect, useState } from 'react'
import { Row } from 'antd'
import { useHistory } from 'react-router-dom'
import styled, { css } from 'styled-components'
import { MintItemViewStatus, INFTMetadata } from '../../../../types/nft_details'
import { SkeletonCommon } from '../../Skeleton/SkeletonCommon'
import { DarkDiv, NFTBanner, TokenSwitch } from './LaunchpadComponents'
import { useNFTLaunchpad } from '../../../../context/nft_launchpad'
import { useUSDCToggle } from '../../../../context/nft_launchpad'
import { useDarkMode, useNavCollapse } from '../../../../context'
import { SpaceBetweenDiv } from '../../../../styles'
import { checkMobile } from '../../../../utils'

//#region styles
const NFT_DETAILS = styled.div<{ $navCollapsed: boolean }>`
  height: 100%;
  margin: 0 auto;
  margin-top: calc(150px - ${({ $navCollapsed }) => ($navCollapsed ? '80px' : '0px')});

  .nd-content {
    height: 100%;
  }

  .detailsContainer {
    display: flex;
    align-items: flex-start;
    justify-content: space-around;
    margin: 20px 70px 50px 0px;

    @media (max-width: 500px) {
      display: block;
    }
  }

  ${({ theme }) => css`
    .nd-back-icon {
      position: absolute;
      top: 132px;
      left: 30px;
      transform: rotate(90deg);
      width: 25px;
      filter: ${theme.filterBackIcon};
      cursor: pointer;
    }
  `};
`

const YELLOW = styled.h3`
  font-weight: 700;
  font-size: 30px;
  line-height: 36.57px;
  margin-bottom: 50px;
  display: flex;
  background: linear-gradient(92.45deg, #ea7e00 6.46%, #f1c52a 107.94%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-fill-color: transparent;
  margin: 0;
  align-items: center;
  .text {
    margin-left: 20px;
  }
`

const TITLE = styled.h1`
  font-weight: 700;
  font-size: 60px;
  line-height: 73px;
  margin-top: 50px;
  color: ${({ theme }) => theme.text1};

  @media (max-width: 500px) {
    font-weight: 700;
    font-size: 35px;
    text-align: center;
    margin-top: 5px;
  }
`

const LEFT_WRAPPER = styled.div`
  width: 35vw;
  .mintContainer {
    display: flex;
    margin-top: 40px;
    .navigationImg {
      cursor: pointer;
    }
  }
`

const DESCRIPTION = styled.p`
  font-weight: 600;
  font-size: 20px;
  line-height: 24px;
  color: ${({ theme }) => theme.text4};
  text-align: justify;

  @media (max-width: 500px) {
    width: 90%;
    margin: 14px auto 30px;
    color: #d4d4d4;
    font-size: 15px;
  }
`
const FEATURED_IMG = styled.div`
  width: 85px;
  height: 90px;
  margin-right: 25px;
`

const BACK_IMG = styled.div`
  width: 40px;
  height: 40px;
  margin-left: -10px;
  transform: scale(1.2);
  margin-right: 30px;
  cursor: pointer;

  @media (max-width: 500px) {
    margin: 0;
    height: 20px;
    width: 20px;
  }
`

const GRAPHIC_IMG = styled.div``

const IMG_CONTAINER = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  .header {
    position: absolute;
    left: 20px;
  }
`

//#endregion
const MINT_BTN = styled.div`
  background: linear-gradient(96.79deg, #f7931a 4.25%, #ac1cc7 97.61%);
  border-radius: 47px;
  width: 219px;
  height: 60px;
  margin-left: -5px;
  display: flex;
  align-items: center;
  font-weight: 600;
  font-size: 15px;
  justify-content: center;
  margin-right: 60px;
  cursor: pointer;

  @media (max-width: 500px) {
    width: 90%;
    margin: 0 auto 65px;
    height: 60px;
    border-radius: 30px;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 18px;
    font-weight: 600;
    color: #fff;
  }
`

const ITEMS = styled.div`
  font-weight: 600;
  font-size: 22px;
  color: ${({ theme }) => theme.text4};

  @media (max-width: 500px) {
    font-size: 18px;
    font-weight: 600;
    padding: 10px 5px;
  }
`
const PRICE_DISPLAY = styled.div`
  display: flex;

  @media (max-width: 500px) {
    align-items: center;
  }
  img {
    height: 25px;
    width: 25px;
    margin: 0px 10px 5px 10px;
    @media (max-width: 500px) {
      margin: 0 2px;
    }
  }
  span {
    @media (max-width: 500px) {
      font-weight: 600;
    }
  }
`

const DETAILS = styled.div`
  display: flex;
  justify-content: space-between;
  width: 90%;
  margin: 0 auto;
  align-items: center;
`

const WRAPPER = styled.div`
  margin-top: 100px;
`
const HEADER = styled.div`
  font-weight: 700;
  font-size: 18px;
  margin-left: 10px;
  background: linear-gradient(92.45deg, #ea7e00 6.46%, #f1c52a 107.94%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
`

export const GetNftPrice: FC<{ item: any }> = ({ item }) => (
  <PRICE_DISPLAY>
    <span>{`Price: ${item?.price}`}</span>
    <img src={`/img/crypto/${item?.currency}.svg`} alt="price" />
    <span>{`  ${item?.currency}`}</span>
  </PRICE_DISPLAY>
)
export const FeaturedLaunch: FC<{
  handleClickPrimaryButton?: (type: string) => void
  status?: MintItemViewStatus
  backUrl?: string
  arbData?: INFTMetadata
}> = ({ ...rest }) => {
  const history = useHistory()

  const { isUSDC } = useUSDCToggle()
  const { liveNFTProjects } = useNFTLaunchpad()
  const [featuredIndex, setFeaturedIndex] = useState<number>(0)
  const [featuredDisplay, setFeaturedDisplay] = useState<any[]>()
  const [featuredList, setFeaturedList] = useState<any[]>([])

  useEffect(() => {
    setFeaturedList(
      isUSDC
        ? liveNFTProjects.filter((data) => data.currency === 'USDC')
        : liveNFTProjects.filter((data) => data.currency === 'SOL')
    )
  }, [isUSDC, liveNFTProjects])

  const handleScroller = (direction: string) => {
    const length = featuredList?.length
    if (direction === '+') {
      setFeaturedIndex((prev) => (prev + 1) % length)
    }
    if (direction === '-') {
      if (featuredIndex === 0) setFeaturedIndex(length - 1)
      else setFeaturedIndex((prev) => (prev - 1) % length)
    }
  }

  useEffect(() => {
    setFeaturedDisplay(featuredList.length > 0 ? [featuredList[featuredIndex]] : [])
  }, [featuredIndex, liveNFTProjects, featuredList])
  const { mode } = useDarkMode()
  const { isCollapsed } = useNavCollapse()

  return checkMobile() ? (
    featuredDisplay && featuredDisplay.length > 0 ? (
      <WRAPPER>
        <IMG_CONTAINER>
          <img
            className="header"
            height="20px"
            src={`/img/assets/arrow-left${mode}.svg`}
            alt="arrow"
            onClick={() => history.goBack()}
          />{' '}
          <img src="/img/assets/Launchpad.png" alt="arrow" height="50px" width="50px" />
          <HEADER> Featured Launch</HEADER>
        </IMG_CONTAINER>
        <TITLE>{featuredDisplay[0]?.collectionName}</TITLE>
        <NFTBanner handleScroller={handleScroller} coverUrl={featuredDisplay[0]?.coverUrl} />
        <DETAILS>
          <ITEMS>{`Items: ${featuredDisplay[0]?.items}`}</ITEMS>
          <ITEMS>
            <GetNftPrice item={featuredDisplay[0]} />
          </ITEMS>
        </DETAILS>
        <DESCRIPTION>{featuredDisplay[0]?.summary}</DESCRIPTION>
        <MINT_BTN onClick={() => history.push(`/NFTs/launchpad/${featuredDisplay[0].urlName}`)}>Mint</MINT_BTN>
      </WRAPPER>
    ) : (
      <></>
    )
  ) : (
    <>
      <NFT_DETAILS {...rest} $navCollapsed={isCollapsed}>
        {!featuredDisplay ? (
          <></>
        ) : (
          <div>
            {featuredDisplay.length > 0 ? (
              <div className="detailsContainer">
                <div className="nd-details">
                  <LEFT_WRAPPER>
                    <YELLOW>
                      <BACK_IMG onClick={() => history.goBack()}>
                        <img src={`/img/assets/arrow-left${mode}.svg`} alt="arrow" />{' '}
                      </BACK_IMG>
                      <FEATURED_IMG>
                        <img src="/img/assets/Launchpad.png" alt="arrow" />{' '}
                      </FEATURED_IMG>
                      Featured Launch
                    </YELLOW>
                    <TITLE className="rs-name">{featuredDisplay[0]?.collectionName}</TITLE>
                    <Row justify="space-between" align="middle" style={{ marginRight: '50px' }}>
                      <ITEMS>{`Items: ${featuredDisplay[0]?.items}`}</ITEMS>
                      <ITEMS>
                        <GetNftPrice item={featuredDisplay[0]} />
                      </ITEMS>
                    </Row>
                    <br />
                    <DESCRIPTION>{featuredDisplay[0]?.summary}</DESCRIPTION>
                    <div className="mintContainer">
                      <MINT_BTN onClick={() => history.push(`/NFTs/launchpad/${featuredDisplay[0].urlName}`)}>
                        Mint
                      </MINT_BTN>
                      <img
                        className="navigationImg"
                        alt="navigateImg"
                        onClick={() => handleScroller('-')}
                        src="/img/assets/navigateLeft.svg"
                      />
                      <img
                        className="navigationImg"
                        alt="navigateImg"
                        onClick={() => handleScroller('+')}
                        src="/img/assets/navigateRight.svg"
                      />
                    </div>
                  </LEFT_WRAPPER>
                </div>
                <GRAPHIC_IMG>
                  {featuredDisplay.length > 0 && (
                    <TokenSwitch disabled={false} currency={featuredDisplay[0]?.currency} />
                  )}

                  {featuredDisplay.length > 0 ? <DarkDiv coverUrl={featuredDisplay[0]?.coverUrl} /> : <></>}
                </GRAPHIC_IMG>
              </div>
            ) : (
              <SpaceBetweenDiv style={{ margin: '0 70px 200px 0' }}>
                <SkeletonCommon width="42vw" height="500px" borderRadius="10px" />
                <SkeletonCommon width="42vw" height="500px" borderRadius="10px" />
              </SpaceBetweenDiv>
            )}
          </div>
        )}
      </NFT_DETAILS>
    </>
  )
}

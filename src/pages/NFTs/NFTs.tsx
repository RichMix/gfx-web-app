import React, { useEffect, FC } from 'react'
import { ILocationState } from '../../types/app_params.d'
import { useRouteMatch, Route, Switch, useLocation } from 'react-router-dom'
import styled from 'styled-components'
import NFTLandingPage from './Home/NFTHome'
import { MyCreatedNFT } from './CreateNFT'
import { Collectible } from './Collectible'
import { UpLoadNFT } from './Collectible/UpLoadNFT'
import { LiveAuction } from './Collectible/LiveAuction'
import { Profile } from './Profile'
import { Explore } from './Profile/Explore'
import { Collection } from './Collection'
import { LiveAuctionNFT } from './LiveAuctionNFT'
import { FixedPriceNFT } from './FixedPriceNFT'
import { OpenBidNFT } from './OpenBidNFT'
import { OverlayProvider } from '../../context/overlay'
import {
  NFTProfileProvider,
  NFTCollectionProvider,
  NFTDetailsProvider,
  useNavCollapse,
  ENDPOINTS,
  useConnectionConfig
} from '../../context'
import { notify } from '../../utils'

const BODY_NFT = styled.div<{ $navCollapsed: boolean }>`
  position: relative;
  width: 100vw;
  height: calc(100vh - ${({ $navCollapsed }) => ($navCollapsed ? '80px' : '160px')});
  overflow-y: scroll;
  overflow-x: hidden;

  * {
    font-family: Montserrat;
  }
  ${({ theme }) => theme.customScrollBar('6px')};
`

const SCROLLING_OVERLAY = styled.div`
  overflow-y: overlay;
  overflow-x: hidden;
`

export const NFTs: FC = () => {
  const { isCollapsed } = useNavCollapse()
  const location = useLocation<ILocationState>()
  const { path } = useRouteMatch()
  const { endpoint, setEndpoint } = useConnectionConfig()

  useEffect(() => {
    if (location.pathname === '/NFTs/create-single' && endpoint !== ENDPOINTS[1].endpoint) {
      notify({ message: `Switched to ${ENDPOINTS[1].network}` })
      setEndpoint(ENDPOINTS[1].endpoint)
    } else if (endpoint !== ENDPOINTS[0].endpoint) {
      setEndpoint(ENDPOINTS[0].endpoint)
    }
  }, [location])

  return (
    <OverlayProvider>
      <NFTProfileProvider>
        <NFTCollectionProvider>
          <NFTDetailsProvider>
            <BODY_NFT $navCollapsed={isCollapsed}>
              <Switch>
                <Route exact path={path}>
                  <NFTLandingPage />
                </Route>
                <Route exact path={['/NFTs/profile', '/NFTs/profile/:userId']}>
                  <SCROLLING_OVERLAY>
                    <Profile />
                  </SCROLLING_OVERLAY>
                </Route>
                <Route exact path="/NFTs/profile/explore">
                  <Explore />
                </Route>
                <Route exact path="/NFTs/collection/:collectionId">
                  <SCROLLING_OVERLAY>
                    <Collection />
                  </SCROLLING_OVERLAY>
                </Route>
                <Route exact path="/NFTs/live-auction/:nftId">
                  <SCROLLING_OVERLAY>
                    <LiveAuctionNFT />
                  </SCROLLING_OVERLAY>
                </Route>
                <Route exact path="/NFTs/fixed-price/:nftId">
                  <SCROLLING_OVERLAY>
                    <FixedPriceNFT />
                  </SCROLLING_OVERLAY>
                </Route>
                <Route exact path="/NFTs/open-bid/:nftId">
                  <OpenBidNFT />
                </Route>
                <Route exact path="/NFTs/create">
                  <Collectible />
                </Route>
                <Route exact path="/NFTs/create-single">
                  <UpLoadNFT />
                </Route>
                <Route exact path="/NFTs/sell">
                  <SCROLLING_OVERLAY>
                    <LiveAuction />
                  </SCROLLING_OVERLAY>
                </Route>
              </Switch>
            </BODY_NFT>
          </NFTDetailsProvider>
        </NFTCollectionProvider>
      </NFTProfileProvider>
    </OverlayProvider>
  )
}

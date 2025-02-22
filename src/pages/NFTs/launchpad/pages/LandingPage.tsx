import React, { FC, useEffect } from 'react'
import LaunchCollection from '../launchpadComp/LaunchCollection'
import UpcomingCollections from './UpcomingCollections'
import EndedCollections from './EndedCollections'
import { FeaturedLaunch } from './FeaturedLaunch'
import styled from 'styled-components'
import { useNavCollapse } from '../../../../context'
import { ModalSlide } from '../../../../components/ModalSlide'
import { MODAL_TYPES } from '../../../../constants'
import { checkMobile } from '../../../../utils'

const WRAPPER = styled.div`
  max-width: 99%;
  padding-left: 70px;

  * {
    font-family: ${({ theme }) => theme.fontFamily};
  }

  @media (max-width: 500px) {
    max-width: 100%;
    padding-left: 0;
  }
`

export const LandingPage: FC = () => {
  const { relaxPopup, setRelaxPopup } = useNavCollapse()

  useEffect(() => {
    setTimeout(() => {
      setRelaxPopup(false)
    }, 5000)
  }, [relaxPopup])

  return (
    <>
      <WRAPPER>
        {relaxPopup && <ModalSlide rewardToggle={setRelaxPopup} modalType={MODAL_TYPES.RELAX} />}
        <FeaturedLaunch />
        <UpcomingCollections />
        {!checkMobile() && <LaunchCollection />}
        <EndedCollections />
      </WRAPPER>
    </>
  )
}

import React from 'react'
import styled, { css } from 'styled-components'
import { columns, STYLED_NAME } from './Columns'
import { Table } from 'antd'
import { STYLED_TABLE_LIST } from './TableList'
import { moneyFormatter, nFormatter, percentFormatter } from '../../utils/math'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import { useFarmContext } from '../../context/farm'

const ROW_CONTAINER = styled.div`
  display: flex;
  margin-left: ${({ theme }) => theme.margin(3)};
  padding-top: ${({ theme }) => theme.margin(3)};
  padding-bottom: ${({ theme }) => theme.margin(2)};
  .set-width {
    width: 17%;
  }
  .set-width-balance {
    width: 18%;
  }
  .set-width-earned {
    width: 22%;
  }
  .set-width-apr {
    width: 22%;
  }
  .set-width-liquidity {
    width: 22%;
  }
  .set-width-volume {
    width: 18%;
  }
`

export const STYLED_EXPAND_ICON = styled.div`
  cursor: pointer;
  padding-top: 20px;
  margin-left: 2.7%;
  filter: ${({ theme }) => theme.filterDownIcon};
  transform: rotate(180deg);
`

interface IFarmData {
  id: string
  image: string
  name: string
  earned: number
  apr: number
  rewards?: string
  liquidity: number
  type: string
  currentlyStaked: number
}

const DisplayRowData = ({ rowData, onExpandIcon }) => {
  return (
    <ROW_CONTAINER>
      <STYLED_NAME className="set-width">
        <img
          className={`coin-image ${rowData?.type === 'Double Sided' ? 'double-sided' : ''}`}
          src={`/img/crypto/${rowData?.image}.svg`}
          alt=""
        />
        <div className="text">{rowData?.name}</div>
      </STYLED_NAME>
      <div className="liquidity normal-text set-width-balance">
        {rowData?.currentlyStaked ? ` ${moneyFormatter(rowData.currentlyStaked)}` : 0.0}
      </div>
      <div className="liquidity normal-text set-width-earned">
        {rowData?.earned ? `${moneyFormatter(rowData?.earned)}` : 0.0}
      </div>
      <div className="liquidity normal-text set-width-apr">
        {rowData?.apr ? `${percentFormatter(rowData?.apr)}` : 0.0}
      </div>
      <div className="liquidity normal-text set-width-liquidity">
        {rowData?.liquidity ? `$ ${moneyFormatter(rowData?.liquidity)}` : 0.0}
      </div>
      <div className="liquidity normal-text set-width-volume">
        {rowData?.volume && rowData?.volume === '-' ? '-' : `$ ${moneyFormatter(rowData?.volume)}`}
      </div>
      <STYLED_EXPAND_ICON onClick={() => onExpandIcon(rowData.id)}>
        <img src={'/img/assets/arrow-down-large.svg'} />
      </STYLED_EXPAND_ICON>
    </ROW_CONTAINER>
  )
}

export default DisplayRowData

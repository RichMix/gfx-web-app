import React from 'react'
import axios from 'axios'

export default function useBlacklisted() {
  const [blacklisted, setBlacklisted] = React.useState(false)
  const banned_countries = ['BY', 'CF', 'CD', 'KP', 'CU', 'IR', 'LY', 'SO', 'SS', 'SD', 'SY', 'TH', 'US', 'YE', 'ZW']

  function setCountry() {
    axios
      .get('https://countrycode.bonfida.workers.dev/')
      .then((response) => {
        let data = response.data
        setBlacklisted(banned_countries.includes(data.countryCode))
      })
      .catch((error) => {
        console.log(error)
      })
  }

  setCountry()

  return blacklisted
}

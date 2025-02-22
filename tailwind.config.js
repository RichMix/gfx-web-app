/*
Here in this file, we mentioned the files where tailwind needs to be integrated in content (All page types).
In the extend property, we mention the css properties which tailwind doesn't provide implicitly.
We can also use this to override any of the tailwind's utility classes.
For responsiveness, we should use prefixes like 'sm, md, lg, xl' with our tailwind utility classes (for max-width),
we should use prefixes like 'min-sm, min-md, min-lg, min-xl' for min-width mediaquery rules.
*/

/*NOTE: To use tailwind's native className prop, we need to have the following two import statements in the same order:
import tw from "twin.macro"
import 'styled-components/macro'
Same goes for using twin.macro's tw and css prop (instead of tailwind's className, tw prop can be used inside JSX and css 
prop is for writing conditional css inside JSX) -- We need to import the above 2 statements
For more details: https://github.com/ben-rogerson/twin.examples/blob/master/cra-styled-components/README.md
*/

module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx,less}", "./index.html"],
  theme: {
    extend: {
      screens: {  
        //WIDTH_UP_TO - @media(max-width: ${max}px)
        'sm': {'max': '500px'},
        'md': {'max': '720px'},
        'lg': {'max': '960px'},
        'xl': {'max': '1280px'},

        //WIDTH_FROM - @media(min-width: ${min-}px)
        'min-sm': '501px',
        'min-md': '721px',
        'min-lg': '961px',
        'min-xl': '1281px'
      },
      colors: {
        'black-1': '#191919',
        'green-1': '#50bb35',
        'gray-1': '#9A9A9A',
        'gray-2': '#636363',
      },
      padding: {
        '0.75': '3px',
        '10p': '10%'
      },
      margin: {
        '3.75': '15px',
        '4.5': '18px'
      },
      fontFamily: {
        'display': ['Monserrat']
      },
      borderRadius: {
        'small': '10px',
        'average': '15px',
        'bigger': '20px',
        'half': '25px',
        'circle': '50px'
      },
      height: {
        '5.5': '22px',
        '11.75': '47px',
        '12.5': '50px',
        '16.25': '65px',
        '17.5': '70px',
        '24.25': '100px',
        'inherit': 'inherit'
      },
      width: {
        '12.5': '50px',
        '21': '84px',
        '81.5': '326px',
        '628': '628px',
        '30p': '30%',
        '85p': '85%',
        'inherit': 'inherit'
      },
      minWidth: {
        '330': '330px',
        'vw': '100vw'
      },
      maxWidth: {
        '330': '330px',
        'vw': '100vw'
      },
      minHeight: {
        '330': '330px',
        '400': '400px',
        'vh': '100vh'
      },
      maxHeight: {
        '90p': '90%',
        '80p':  '80%',
        'vh': '100vh'
      },
      fontSize: {
        'smallest': '11px',
        'smaller': '13px',
        'tiny': '15px',
        'regular': '18px',
        'average': '22px',
        'big': '40px',
      }
    },
  },
  plugins: [],
}

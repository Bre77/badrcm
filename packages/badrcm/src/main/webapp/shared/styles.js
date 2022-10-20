import { createGlobalStyle } from 'styled-components';
import variables from '@splunk/themes/variables';

const GlobalStyle = createGlobalStyle`
    body {
        background-color: ${variables.backgroundColorPage};
        color: blue;
    }
`
export { GlobalStyle };

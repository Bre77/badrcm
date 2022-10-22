
import React from 'react';
import layout from '@splunk/react-page';
import { getUserTheme } from '@splunk/splunk-utils/themes';
import { createGlobalStyle } from 'styled-components';
import variables from '@splunk/themes/variables';

const GlobalStyle = createGlobalStyle`
    body {
        background-color: ${variables.backgroundColorPage};
        color: blue;
    }
`

export default (component) => getUserTheme()
    .then((theme) => {
        layout(
            <>
                <GlobalStyle />
                {component}
            </>,
            { theme }
        );
    })
    .catch((e) => {
        const errorEl = document.createElement('span');
        errorEl.innerHTML = e;
        document.body.appendChild(errorEl);
    });
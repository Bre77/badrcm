import styled from 'styled-components';
import { variables, mixins } from '@splunk/themes';

export const StyledContainer = styled.div`
    ${mixins.reset('inline')};
    display: block;
    font-size: ${variables.fontSizeLarge};
    line-height: 200%;
    margin: calc(${variables.spacing} * 2) calc(${variables.spacing} * 2);
`;

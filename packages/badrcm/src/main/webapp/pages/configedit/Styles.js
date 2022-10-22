import styled, { createGlobalStyle } from 'styled-components';
import { variables, mixins } from '@splunk/themes';
import Table from '@splunk/react-ui/Table';

const StyledContainer = styled.div`
    ${mixins.reset('inline')};
    display: block;
    font-size: ${variables.fontSizeLarge};
    line-height: 200%;
    margin: calc(${variables.spacing}) calc(${variables.spacing});
`;

const StanzaSpan = styled.span`
    font-weight:bold;
    color: #E00000;
`;

const AttributeSpan = styled.span`
    color: #863B00;
`;

const InfoCell = styled(Table.Cell)`
    padding-top: 2px !important; 
    padding-bottom: 2px !important;

`
const AttributeCell = styled(Table.Cell)`
    padding-top: 8px !important; 
    padding-bottom: 8px !important;
    color: #863B00;
`
const InputCell = styled(Table.Cell)`
    padding-top: 2px !important;
    padding-bottom: 2px !important;

`

export { StyledContainer, StanzaSpan, AttributeSpan, InfoCell, AttributeCell, InputCell };

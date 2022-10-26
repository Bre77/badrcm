import styled from 'styled-components';
import { variables, mixins } from '@splunk/themes';
import Table from '@splunk/react-ui/Table';
import Link from '@splunk/react-ui/Link';

export const StyledContainer = styled.div`
    ${mixins.reset('inline')};
    display: block;
    font-size: ${variables.fontSizeLarge};
    line-height: 200%;
    margin: calc(${variables.spacing}) calc(${variables.spacing});
`;

export const ShortCell = styled(Table.Cell)`
    padding-top: 2px !important; 
    padding-bottom: 2px !important;

`
export const TallCell = styled(Table.Cell)`
    padding-top: 8px !important;
    padding-bottom: 8px !important;

`
export const CreateLink = styled(Link)`
    font-style: italic;
`

export const StanzaSpan = styled.span`
    font-weight:bold;
    color: #DE0013;
`;

export const AttributeSpan = styled.span`
    color: ${props => props.theme.splunkThemeV1.colorScheme === "light" ? "#853A0A" : "#9EDCFD"};
`;

export const ValueSpan = styled.span`
    color: ${props => props.theme.splunkThemeV1.colorScheme === "light" ? "#0451A5" : "#CE9178"};
`;

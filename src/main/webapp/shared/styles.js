import Flag from "@splunk/react-icons/Flag";
import Link from '@splunk/react-ui/Link';
import Table from '@splunk/react-ui/Table';
import WaitSpinner from '@splunk/react-ui/WaitSpinner';
import { mixins, variables } from '@splunk/themes';
import styled from 'styled-components';

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

export const Actions = styled.div`
  float:right;
  span {
    padding-left: 4px;
  }
`;

export const TextSpinner = styled(WaitSpinner)`
    padding-right: 8px;
    svg{
        vertical-align: middle
    }
`

export const SwitchSpinner = styled(WaitSpinner)`
svg{padding: 2px 2px 0 0}
`

export const RedFlag = styled(Flag)`
    color: 'red';
    float:left;
`
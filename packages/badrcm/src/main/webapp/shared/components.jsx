import React, { useState } from 'react';
import Button from '@splunk/react-ui/Button';


const AsyncButton = (props) => {
    const [running, setRunning] = useState(false);

    const action = (e, x) => {
        setRunning(true)
        return props.onClick(e, x).then(setRunning(false))
    }

    return <Button label={running.toString()} onClick={action} disabled={running} />
}


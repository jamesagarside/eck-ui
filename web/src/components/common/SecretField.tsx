import { useState } from 'react';
import {
  EuiFieldText,
  EuiButtonIcon,
  EuiCopy,
  EuiToolTip,
} from '@elastic/eui';

interface SecretFieldProps {
  value: string;
}

const MASK = '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022';

export function SecretField({ value }: SecretFieldProps) {
  const [isRevealed, setIsRevealed] = useState(false);

  const toggleButton = (
    <EuiToolTip content={isRevealed ? 'Hide value' : 'Reveal value'}>
      <EuiButtonIcon
        iconType={isRevealed ? 'eyeClosed' : 'eye'}
        aria-label={isRevealed ? 'Hide secret value' : 'Reveal secret value'}
        onClick={() => setIsRevealed((prev) => !prev)}
      />
    </EuiToolTip>
  );

  const copyButton = (
    <EuiCopy textToCopy={value}>
      {(copy) => (
        <EuiToolTip content="Copy to clipboard">
          <EuiButtonIcon
            iconType="copy"
            aria-label="Copy secret value to clipboard"
            onClick={copy}
          />
        </EuiToolTip>
      )}
    </EuiCopy>
  );

  return (
    <EuiFieldText
      value={isRevealed ? value : MASK}
      readOnly
      append={[toggleButton, copyButton]}
      aria-label="Secret value"
    />
  );
}

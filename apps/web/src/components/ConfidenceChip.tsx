import * as Tooltip from '@radix-ui/react-tooltip';
import { M } from '../messages';

type Confidence = keyof typeof M.confidence extends infer K ? Exclude<K, 'secondaryTip'> : never;

const STYLE: Record<string, string> = {
  PRIMARY: 'border-ok text-ok bg-ok-bg',
  SECONDARY: 'border-warn text-warn bg-warn-bg',
  DERIVED: 'border-warn text-warn bg-warn-bg',
  PLATFORM: 'border-info text-info bg-info-bg',
  UNVERIFIED: 'border-warn text-warn bg-warn-bg',
};

/** 07 §3.3 — source-confidence chip on every citation. */
export function ConfidenceChip({ confidence }: { confidence: string }) {
  const chip = <span className={`chip ${STYLE[confidence] ?? STYLE.SECONDARY}`}>● {M.confidence[confidence as Confidence] ?? confidence}</span>;
  if (confidence !== 'SECONDARY' && confidence !== 'UNVERIFIED') return chip;
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{chip}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="rounded-sm border border-line bg-white px-2 py-1 text-xs shadow">{M.confidence.secondaryTip}</Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

import * as Tooltip from '@radix-ui/react-tooltip';

/** A disabled action that still explains itself (20 §reading-order 6: every disabled primary carries its reason). */
export function DisabledButton({ label, reason, primary = false }: { label: string; reason: string; primary?: boolean }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <span tabIndex={0} className="inline-block" aria-label={`${label} — ${reason}`}>
          <button type="button" disabled className={primary ? 'btn-primary pointer-events-none' : 'btn pointer-events-none'} title={reason}>
            {label}
          </button>
        </span>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="rounded-sm border border-line bg-white px-2 py-1 text-xs shadow">{reason}</Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

import type { Member } from "../api/members";
import { matchesMember, memberLetter, memberTint, sharedLabel, type MemberFilter } from "./members";
import { useT } from "../i18n/index.ts";

/* The three faces of "whose is this", one vocabulary:

   MemberAvatar — the chip itself, beside a name in a list or a form.
   MemberPicker — WHOSE a new row is: 共同 or one member. A form's first
     question on a phone, where the answer is who paid.
   MemberBar — the filter: everyone, the shared rows, or one member. It
     changes what is SHOWN and never what is stored; a list under it says how
     many rows it hides (the eleventh expense of a ten-in-a-row session must
     never vanish in silence). */

export function MemberAvatar({
  member,
  size = 24,
}: {
  /** A member, or null for 共同 (shared). */
  member: { id: number | null; name: string | null } | null;
  size?: number;
}) {
  return (
    <span
      aria-hidden="true"
      className={
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white " +
        `bg-${memberTint(member?.id ?? null)}`
      }
      style={{ width: size, height: size, fontSize: Math.round(size * 0.5) }}
    >
      {memberLetter(member?.name ?? null, member?.id ?? null)}
    </span>
  );
}

/** The chips of MemberAvatar with their names, laid out for a form row. */
export function MemberPicker({
  members,
  value,
  onChange,
}: {
  members: Member[];
  /** The attribution: a member id, or null for 共同. */
  value: number | null;
  onChange: (memberId: number | null) => void;
}) {
  const tr = useT();
  return (
    <div role="group" aria-label={tr("members.whose")} className="flex flex-wrap gap-2">
      <Chip
        selected={value === null}
        onClick={() => onChange(null)}
        label={sharedLabel()}
        tint="kin-shared"
        letter="家"
      />
      {members.map((m) => (
        <Chip
          key={m.id}
          selected={value === m.id}
          onClick={() => onChange(m.id)}
          label={m.name}
          tint={memberTint(m.id)}
          letter={memberLetter(m.name, m.id)}
        />
      ))}
    </div>
  );
}

/** The filter: everyone first, then 共同, then the household. */
export function MemberBar({
  members,
  filter,
  onFilter,
}: {
  members: Member[];
  filter: MemberFilter;
  onFilter: (filter: MemberFilter) => void;
}) {
  const tr = useT();
  return (
    <div role="group" aria-label={tr("members.filter")} className="flex flex-wrap gap-2">
      <Chip
        selected={filter === "all"}
        onClick={() => onFilter("all")}
        label={tr("members.all")}
        tint="kin-shared"
        letter="家"
        mutedLetter
      />
      <Chip
        selected={filter === null}
        onClick={() => onFilter(null)}
        label={sharedLabel()}
        tint="kin-shared"
        letter="共"
      />
      {members.map((m) => (
        <Chip
          key={m.id}
          selected={filter === m.id}
          onClick={() => onFilter(m.id)}
          label={m.name}
          tint={memberTint(m.id)}
          letter={memberLetter(m.name, m.id)}
        />
      ))}
    </div>
  );
}

/** How many rows the filter is not showing. Printed under the list, always —
    a filter hides rows on purpose, and silence about how many is how a reader
    comes to believe the eleventh expense never happened. */
export function HiddenNote({ hidden, filter }: { hidden: number; filter: MemberFilter }) {
  const tr = useT();
  if (filter === "all" || hidden === 0) return null;
  return (
    <p className="mt-2 text-xs text-ink-faint">{tr("members.hidden", { count: hidden })}</p>
  );
}

function Chip({
  selected,
  onClick,
  label,
  tint,
  letter,
  mutedLetter,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  tint: string;
  letter: string;
  mutedLetter?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={
        "flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-sm transition " +
        (selected
          ? "border-brand bg-brand-tint text-brand"
          : "border-hair text-ink-soft hover:border-rule hover:text-ink")
      }
    >
      <span
        aria-hidden="true"
        className={
          "inline-flex h-5 w-5 items-center justify-center rounded-full text-[0.65rem] font-semibold " +
          (mutedLetter ? "bg-tint text-ink-soft" : `bg-${tint} text-white`)
        }
      >
        {letter}
      </span>
      {label}
    </button>
  );
}

export { matchesMember };
export type { MemberFilter };

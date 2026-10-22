import { useState } from "react";
import {
  createMember,
  deleteMember,
  updateMember,
  type Member,
} from "../api/members";
import { MemberAvatar } from "./MemberPicker";
import { apiError, btnClass, cardClass, inputClass, RowsOrEmpty } from "./ui";
import { useT, type MessageKey } from "../i18n/index.ts";

/* The household, managed (PRD v3 §4.1, 家庭账本).

   Members are edited where they are defined and NOT behind the page's one
   Save button: adding someone is a fact about the world, not a pending change
   to a questionnaire, and the pickers on every form read this list live. The
   delete is the one row with a consequence worth spelling out — the member's
   rows become shared (共同) — so it asks before it goes. */

const ROLES: MessageKey[] = [
  "members.role.self",
  "members.role.spouse",
  "members.role.child",
  "members.role.parent",
  "members.role.other",
];

export default function MembersSection({
  members,
  onChanged,
}: {
  members: Member[];
  onChanged: () => void;
}) {
  const tr = useT();
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit(m: Member) {
    setEditing(m.id);
    setConfirming(null);
    setName(m.name);
    setRole(m.role ?? "");
  }

  function reset() {
    setEditing(null);
    setName("");
    setRole("");
  }

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      if (editing === null) {
        await createMember({ name: trimmed, role: role || null });
      } else {
        await updateMember(editing, { name: trimmed, role: role || null });
      }
      reset();
      onChanged();
    } catch (e) {
      setError(apiError(e, tr("members.saveFailed")));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    setBusy(true);
    setError(null);
    try {
      await deleteMember(id);
      setConfirming(null);
      if (editing === id) reset();
      onChanged();
    } catch (e) {
      setError(apiError(e, tr("members.saveFailed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={cardClass + " space-y-4 p-5"}>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-ink">{tr("members.title")}</h3>
        <p className="max-w-[68ch] text-sm text-ink-soft">{tr("members.intro")}</p>
      </div>

      <RowsOrEmpty
        loading={false}
        error={null}
        empty={members.length === 0}
        emptyText={tr("members.empty")}
      >
        {members.map((m) => (
          <li key={m.id}>
            <div className="flex min-w-0 items-center gap-3 px-4 py-3">
              <MemberAvatar member={m} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-ink">{m.name}</div>
                <div className="text-xs text-ink-soft">
                  {m.role ? tr(`members.role.${m.role}` as MessageKey) : tr("members.roleBlank")}
                </div>
              </div>
              <button
                onClick={() => startEdit(m)}
                aria-label={tr("common.edit")}
                title={tr("common.edit")}
                className="shrink-0 px-2 py-2 text-ink-faint transition hover:text-brand"
              >
                ✎
              </button>
              <button
                onClick={() => {
                  setConfirming(m.id);
                  setEditing(null);
                }}
                aria-label={tr("common.delete")}
                title={tr("common.delete")}
                className="shrink-0 px-2 py-2 text-ink-faint transition hover:text-bad"
              >
                ✕
              </button>
            </div>
            {confirming === m.id && (
              <div className="border-l-2 border-bad bg-bad-tint px-4 py-2 text-xs text-bad">
                {tr("members.deleteAsk", { name: m.name })}{" "}
                <button
                  onClick={() => void remove(m.id)}
                  disabled={busy}
                  className="font-medium underline"
                >
                  {tr("common.delete")}
                </button>{" "}
                <button onClick={() => setConfirming(null)} className="underline">
                  {tr("common.cancel")}
                </button>
              </div>
            )}
          </li>
        ))}
      </RowsOrEmpty>

      <div className="flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="mb-1 block text-xs text-ink-soft">{tr("members.name")}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass + " w-36"}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-ink-soft">{tr("members.role")}</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className={inputClass + " w-28"}
          >
            <option value="">{tr("members.roleBlank")}</option>
            {ROLES.map((r) => (
              <option key={r} value={r.replace("members.role.", "")}>
                {tr(r)}
              </option>
            ))}
          </select>
        </label>
        <button onClick={() => void submit()} disabled={busy || !name.trim()} className={btnClass}>
          {editing === null ? tr("members.add") : tr("common.save")}
        </button>
        {editing !== null && (
          <button onClick={reset} className="rounded-sm px-3 py-2 text-sm text-ink-soft hover:text-ink">
            {tr("common.cancel")}
          </button>
        )}
      </div>
      {error && <p className="text-sm text-bad">{error}</p>}
    </section>
  );
}

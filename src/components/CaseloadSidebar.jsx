import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Search, X } from 'lucide-react'
import { conversationMatches, statusLabel } from '../lib/caseload.js'
import Icon from './ui/Icon.jsx'

function FolderIcon({ open }) {
  return <Icon icon={open ? ChevronDown : ChevronRight} size="sm" className="text-ink-3" />
}

function StudentRow({ conversation, schoolName, active, onSelect, onMove, schoolOptions, onDelete }) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/student-id', conversation.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      className={`group mb-1 flex items-center rounded-control ${
        active ? 'bg-brand-tint text-ink' : 'text-ink-2 hover:bg-paper hover:text-ink'
      }`}
    >
      <button
        type="button"
        onClick={() => onSelect(conversation.id)}
        className="min-w-0 flex-1 px-3 py-2 text-left"
      >
        <span className="block truncate font-sans text-14">{conversation.title}</span>
        <span className="block truncate font-sans text-12 text-ink-3">{statusLabel(conversation)}</span>
      </button>
      <label className="sr-only" htmlFor={`move-${conversation.id}`}>
        Move {conversation.title} to another school
      </label>
      <select
        id={`move-${conversation.id}`}
        className="mr-1 hidden bg-transparent font-sans text-12 text-ink-3 group-hover:block"
        value={conversation.schoolId ?? ''}
        onChange={(e) => onMove(conversation.id, e.target.value || null)}
        onClick={(e) => e.stopPropagation()}
      >
        <option value="">Unfiled</option>
        {schoolOptions.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="hidden px-2 text-ink-3 hover:text-flag group-hover:block"
        aria-label={`Remove ${conversation.title}`}
        onClick={(e) => {
          e.stopPropagation()
          onDelete(conversation.id)
        }}
      >
        <Icon icon={X} size="sm" />
      </button>
      <span className="sr-only">{schoolName}</span>
    </div>
  )
}

export default function CaseloadSidebar({
  schools,
  conversations,
  activeId,
  query,
  onQuery,
  onSelectStudent,
  onNewStudent,
  onNewSchool,
  onRenameSchool,
  onToggleSchool,
  onMoveStudent,
  onDeleteStudent,
  onDeleteSchool,
}) {
  const [renamingId, setRenamingId] = useState(null)
  const [draftName, setDraftName] = useState('')
  const [dropId, setDropId] = useState(null)

  useEffect(() => {
    if (!renamingId) return
    const school = schools.find((s) => s.id === renamingId)
    setDraftName(school?.name ?? '')
  }, [renamingId, schools])

  function commitRename() {
    if (renamingId && draftName.trim()) onRenameSchool(renamingId, draftName.trim())
    setRenamingId(null)
  }

  function studentsIn(schoolId) {
    return conversations
      .filter((c) => (c.schoolId ?? null) === (schoolId ?? null))
      .filter((c) => {
        const school = schools.find((s) => s.id === c.schoolId)
        return conversationMatches(c, school?.name ?? 'Unfiled', query)
      })
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
  }

  const unfiled = studentsIn(null)
  const schoolNameHits = schools.filter((s) => s.name.toLowerCase().includes(query.trim().toLowerCase()))

  function showSchool(school) {
    if (!query.trim()) return true
    if (schoolNameHits.some((s) => s.id === school.id)) return true
    return studentsIn(school.id).length > 0
  }

  function onDropStudent(schoolId, e) {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/student-id')
    setDropId(null)
    if (id) onMoveStudent(id, schoolId)
  }

  return (
    <aside className="history-pane flex h-full shrink-0 flex-col border-r border-rule bg-surface">
      <div className="border-b border-rule px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="font-sans text-14 font-medium text-ink">Caseload</p>
          <button
            type="button"
            className="rounded-control p-2 text-ink-3 hover:bg-paper hover:text-ink"
            aria-label="New school"
            onClick={onNewSchool}
          >
            <Icon icon={Plus} size="sm" />
          </button>
        </div>
        <label className="sr-only" htmlFor="caseload-search">
          Search students
        </label>
        <div className="relative mt-3">
          <Icon
            icon={Search}
            size="sm"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
          />
          <input
            id="caseload-search"
            type="text"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search students"
            className="w-full rounded-control border border-rule bg-paper py-2 pl-10 pr-3 font-sans text-body-sm text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none"
          />
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto p-2" aria-label="Students by school">
        {schools.filter(showSchool).map((school) => {
          const kids = query.trim() && school.name.toLowerCase().includes(query.trim().toLowerCase())
            ? conversations
                .filter((c) => c.schoolId === school.id)
                .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
            : studentsIn(school.id)
          const open = !school.collapsed || Boolean(query.trim())
          const dropping = dropId === school.id
          return (
            <section
              key={school.id}
              className={`mb-2 rounded-control ${dropping ? 'bg-brand-tint' : ''}`}
              onDragOver={(e) => {
                e.preventDefault()
                setDropId(school.id)
              }}
              onDragLeave={() => setDropId((id) => (id === school.id ? null : id))}
              onDrop={(e) => onDropStudent(school.id, e)}
            >
              <div className="group flex items-center gap-1 px-1 py-1">
                {renamingId === school.id ? (
                  <div className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1">
                    <FolderIcon open={open} />
                    <input
                      autoFocus
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename()
                        if (e.key === 'Escape') setRenamingId(null)
                      }}
                      className="w-full rounded-control border border-brand bg-surface px-1 font-sans text-14 text-ink focus:outline-none"
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-control px-2 py-1 text-left hover:bg-paper"
                    onClick={() => onToggleSchool(school.id)}
                    onDoubleClick={() => setRenamingId(school.id)}
                    aria-expanded={open}
                  >
                    <FolderIcon open={open} />
                    <span className="min-w-0 font-sans text-14 font-medium text-ink">{school.name}</span>
                  </button>
                )}
                <button
                  type="button"
                  className="rounded-control px-2 py-1 text-ink-3 hover:bg-paper hover:text-ink"
                  aria-label={`Add a student at ${school.name}`}
                  onClick={() => onNewStudent(school.id)}
                >
                  <Icon icon={Plus} size="sm" />
                </button>
                <button
                  type="button"
                  className="rounded-control px-1 py-1 text-ink-3 opacity-0 hover:text-flag group-hover:opacity-100"
                  aria-label={`Remove ${school.name}`}
                  onClick={() => onDeleteSchool(school.id)}
                >
                  <Icon icon={X} size="sm" />
                </button>
              </div>
              {open && kids.length > 0 && (
                <div className="ml-4">
                  {kids.map((c) => (
                    <StudentRow
                      key={c.id}
                      conversation={c}
                      schoolName={school.name}
                      active={c.id === activeId}
                      onSelect={onSelectStudent}
                      onMove={onMoveStudent}
                      schoolOptions={schools}
                      onDelete={onDeleteStudent}
                    />
                  ))}
                </div>
              )}
            </section>
          )
        })}

        {(unfiled.length > 0 || !query.trim()) && (
          <section
            className={`mb-2 rounded-control ${dropId === 'unfiled' ? 'bg-brand-tint' : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
              setDropId('unfiled')
            }}
            onDragLeave={() => setDropId((id) => (id === 'unfiled' ? null : id))}
            onDrop={(e) => onDropStudent(null, e)}
          >
            <div className="flex items-center justify-between px-3 py-2">
              <p className="font-sans text-14 font-medium text-ink">Unfiled</p>
              <button
                type="button"
                className="rounded-control px-2 py-1 text-ink-3 hover:bg-paper hover:text-ink"
                aria-label="Add an unfiled student"
                onClick={() => onNewStudent(null)}
              >
                <Icon icon={Plus} size="sm" />
              </button>
            </div>
            {unfiled.map((c) => (
              <StudentRow
                key={c.id}
                conversation={c}
                schoolName="Unfiled"
                active={c.id === activeId}
                onSelect={onSelectStudent}
                onMove={onMoveStudent}
                schoolOptions={schools}
                onDelete={onDeleteStudent}
              />
            ))}
          </section>
        )}

        {query.trim() && schools.filter(showSchool).length === 0 && unfiled.length === 0 && (
          <p className="px-3 py-4 font-sans text-14 text-ink-3">No students match that search.</p>
        )}
      </nav>

      <p className="border-t border-rule px-4 py-3 font-sans text-12 text-ink-3">Saved on this device.</p>
    </aside>
  )
}

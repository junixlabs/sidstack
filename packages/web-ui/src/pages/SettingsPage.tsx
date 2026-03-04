import { useState } from 'react';

type Tab = 'organization' | 'members' | 'projects' | 'api-keys';

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('organization');

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold mb-1">Settings</h1>
        <p className="text-sm text-[var(--text-secondary)]">Organization and project configuration</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-[var(--border)] mb-6">
        {(['organization', 'members', 'projects', 'api-keys'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors capitalize
              ${tab === t ? 'text-[var(--accent)] border-[var(--accent)]' : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text)]'}`}
          >{t.replace('-', ' ')}</button>
        ))}
      </div>

      {tab === 'organization' && (
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1.5">Organization Name</label>
            <input className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-md bg-white focus:outline-none focus:border-[var(--accent)]" defaultValue="My Organization" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Slug</label>
            <input className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-md bg-[var(--bg-secondary)] text-[var(--text-muted)]" value="my-org" disabled />
          </div>
          <button className="px-4 py-2 bg-[var(--accent)] text-white rounded-md text-sm font-medium hover:bg-[var(--accent-hover)]">
            Save Changes
          </button>
        </div>
      )}

      {tab === 'members' && (
        <div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-[0.03em] py-2.5 px-3 bg-[var(--bg-secondary)] border-b border-[var(--border)]">Name</th>
                  <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-[0.03em] py-2.5 px-3 bg-[var(--bg-secondary)] border-b border-[var(--border)]">Email</th>
                  <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-[0.03em] py-2.5 px-3 bg-[var(--bg-secondary)] border-b border-[var(--border)] w-24">Role</th>
                  <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-[0.03em] py-2.5 px-3 bg-[var(--bg-secondary)] border-b border-[var(--border)] w-16"></th>
                </tr>
              </thead>
              <tbody>
                <tr className="hover:bg-[var(--bg-secondary)]">
                  <td className="py-2.5 px-3 border-b border-[var(--border-light)] font-medium">Admin User</td>
                  <td className="py-2.5 px-3 border-b border-[var(--border-light)] text-[var(--text-muted)]">admin@example.com</td>
                  <td className="py-2.5 px-3 border-b border-[var(--border-light)]">
                    <span className="text-[11px] px-2 py-0.5 rounded font-semibold bg-[var(--purple-bg)] text-[var(--purple-text)]">Admin</span>
                  </td>
                  <td className="py-2.5 px-3 border-b border-[var(--border-light)]"></td>
                </tr>
              </tbody>
            </table>
          </div>
          <button className="mt-4 px-4 py-2 border border-[var(--border)] rounded-md text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]">
            + Invite Member
          </button>
        </div>
      )}

      {tab === 'projects' && (
        <div className="text-sm text-[var(--text-muted)] text-center py-16">
          Project management will be available in a future release.
        </div>
      )}

      {tab === 'api-keys' && (
        <div className="text-sm text-[var(--text-muted)] text-center py-16">
          API key management will be available in a future release.
        </div>
      )}
    </div>
  );
}

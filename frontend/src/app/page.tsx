import ChatWindow from "@/components/ChatWindow";
import ErrorNotice from "@/components/ErrorNotice";
import JournalEntryForm from "@/components/JournalEntryForm";
import { getAccounts, getJournalEntries } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

export default async function JournalEntriesPage() {
  let accounts, entries;

  try {
    [accounts, entries] = await Promise.all([
      getAccounts(),
      getJournalEntries(),
    ]);
  } catch (error) {
    return (
      <ErrorNotice
        message={error instanceof Error ? error.message : "Unknown error"}
      />
    );
  }

  const accountNames = new Map(accounts.map((a) => [a.code, a.name]));

  return (
    <div className="flex flex-col gap-10">
      <section>
        <h1 className="mb-4 text-xl font-semibold">New Journal Entry</h1>
        <ChatWindow accounts={accounts} />
      </section>

      <section>
        <h2 className="mb-4 text-lg font-medium text-zinc-500">
          Or enter manually
        </h2>
        <JournalEntryForm accounts={accounts} />
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">Journal Entries</h2>
        {entries.length === 0 ? (
          <p className="text-sm text-zinc-500">No journal entries yet.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-black/10 text-left dark:border-white/15">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Description</th>
                <th className="py-2 pr-4">Debit</th>
                <th className="py-2 pr-4">Credit</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-black/5 align-top dark:border-white/10"
                >
                  <td className="py-2 pr-4 whitespace-nowrap">
                    {entry.date}
                  </td>
                  <td className="py-2 pr-4">{entry.description}</td>
                  <td className="py-2 pr-4">
                    {entry.debit.map((line, i) => (
                      <div key={i}>
                        {accountNames.get(line.account) ?? line.account}{" "}
                        {formatCurrency(line.amount)}
                      </div>
                    ))}
                  </td>
                  <td className="py-2 pr-4">
                    {entry.credit.map((line, i) => (
                      <div key={i}>
                        {accountNames.get(line.account) ?? line.account}{" "}
                        {formatCurrency(line.amount)}
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

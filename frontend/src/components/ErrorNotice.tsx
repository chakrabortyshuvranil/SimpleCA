export default function ErrorNotice({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
      <p className="font-medium">Could not load data from the backend.</p>
      <p className="mt-1 text-red-700 dark:text-red-300">{message}</p>
    </div>
  );
}

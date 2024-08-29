import { useState } from "react";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function App() {
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(
        "https://webhook.latenode.com/11681/prod/84908c3c-1283-4f18-9ef3-d773bd08ad6e",
        {
          duration,
          notes: `WebForm: ${notes.trim()}`,
        },
      );
      toast.success("Seizure logged!");
      setDuration("");
      setNotes("");
    } catch (error) {
      toast.error("Failed to submit data.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen min-w-[300px] items-center justify-center bg-zinc-800 font-normal text-white leading-6 text-opacity-90">
      <div className="m-0 flex max-w-[800px] flex-grow flex-col justify-between p-8 text-center">
        <div className="flex flex-grow flex-col justify-center">
          <div className="mb-4 font-bold text-2xl">Seizure Tracking</div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col text-left">
              <label
                htmlFor="duration"
                className="block font-medium text-sm text-white"
              >
                Duration (seconds)
              </label>
              <input
                type="number"
                id="duration"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 p-2 text-black shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-md"
                required
              />
            </div>
            <div className="flex flex-col">
              <label
                htmlFor="notes"
                className="block text-left font-medium text-sm text-white"
              >
                Notes
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 p-2 text-black shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-md"
                rows={4}
              />
            </div>
            <button
              type="submit"
              className="inline-flex justify-center rounded-md border border-transparent bg-green-700 px-4 py-2 font-medium text-sm text-white shadow-sm hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              disabled={loading}
            >
              {loading ? (
                // biome-ignore lint/a11y/noSvgWithoutTitle: <explanation>
                <svg
                  className="h-5 w-5 animate-spin text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              ) : (
                "Submit"
              )}
            </button>
          </form>
        </div>
      </div>
      <ToastContainer />
    </div>
  );
}

export default App;

import { RvLayout } from '../components/RvLayout';

export default function About() {
  return (
    <RvLayout title="About">
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-5">
        <div className="bg-white rounded-xl shadow-rv-card p-5">
          <h2 className="text-xl font-bold text-gray-900 mb-2">CrumbWorks</h2>
          <p className="text-gray-700">
            A refined recipe organizer focusing on clarity, accessibility, and offline reliability.
          </p>
        </div>
      </div>
    </RvLayout>
  );
}

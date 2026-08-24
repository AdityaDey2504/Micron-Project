import React from 'react';
import { Link } from 'react-router';

interface SectionProps {
  title: string;
  items: number[];
  badge?: string;
}

const Section: React.FC<SectionProps> = ({ title, badge, items }) => (
  <section className="mb-12">
    <div className="flex items-center space-x-2 mb-4">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {badge && <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-full">{badge}</span>}
    </div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {items.map((i) => (
        <Link 
          key={i} 
          to={`/product/${i}`}
          className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm hover:border-indigo-600 transition block"
        >
          <div className="h-40 bg-slate-100 rounded-lg mb-3 flex items-center justify-center text-slate-400 text-xs">Image</div>
          <p className="text-sm font-medium text-slate-800">Minimalist Item #{i}</p>
          <p className="text-xs text-slate-500 mt-1">$49.00</p>
        </Link>
      ))}
    </div>
  </section>
);

const Home: React.FC = () => {
  return (
    <div>
      <Section title="Most Popular" items={[1, 2, 3, 4]} />
      <Section title="Discounted Deals" items={[5, 6, 7, 8]} />
      <Section title="What's New" items={[9, 10, 11, 12]} />
      <Section title="Buy Again" items={[13, 14]} />
      <Section title="Might Be Relevant To You" badge="AI Recommended" items={[15, 16, 17, 18]} />
    </div>
  );
};

export default Home;
import React from 'react';

const CustomerDetails: React.FC = () => {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Account Profile</h2>
        <p className="text-xs text-slate-500">jane.doe@example.com</p>
      </div>

      <hr className="border-slate-100" />

      <div>
        <h3 className="font-semibold text-sm mb-4">Order History</h3>
        <div className="space-y-3 text-xs">
          {[1, 2].map((order) => (
            <div key={order} className="border border-slate-200 rounded-lg p-4 flex justify-between items-center">
              <div>
                <p className="font-medium text-slate-800">Order #ORD-882{order}</p>
                <p className="text-slate-500 mt-0.5">2 Items • Delivered</p>
              </div>
              <span className="font-semibold text-slate-900">$128.00</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CustomerDetails;
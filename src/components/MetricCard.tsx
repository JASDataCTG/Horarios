import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  iconColorClass: string;
  bgColorClass: string;
}

export default function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  iconColorClass,
  bgColorClass
}: MetricCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex items-start justify-between hover:shadow-md transition-shadow">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</p>
        <h3 className="text-3xl font-bold font-sans text-slate-800 mt-1">{value}</h3>
        {description && (
          <p className="text-xs text-slate-500 mt-1 font-sans">{description}</p>
        )}
      </div>
      <div className={`p-3 rounded-xl ${bgColorClass}`}>
        <Icon className={`w-5 h-5 ${iconColorClass}`} />
      </div>
    </div>
  );
}

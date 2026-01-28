import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => {
  return (
    <div
      className={`animate-pulse bg-gray-300 dark:bg-gray-700 rounded ${className}`}
      aria-hidden="true"
    />
  );
};

export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({
  lines = 3,
  className = ''
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-4 ${i === lines - 1 ? 'w-3/4' : 'w-full'}`}
        />
      ))}
    </div>
  );
};

export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`card bg-base-100 shadow-sm ${className}`}>
      <div className="card-body space-y-4">
        <div className="flex items-center space-x-3">
          <Skeleton className="w-12 h-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
        <SkeletonText lines={2} />
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      </div>
    </div>
  );
};

export const SkeletonActivityCard: React.FC = () => {
  return (
    <div className="card bg-base-100 shadow-md">
      <div className="card-body">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-3 flex-1">
            <Skeleton className="w-16 h-16 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
          <Skeleton className="w-16 h-16 rounded-full" />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="flex justify-between">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
        <Skeleton className="h-10 w-full rounded-lg mt-4" />
      </div>
    </div>
  );
};

export const SkeletonHeroCard: React.FC = () => {
  return (
    <div
      className="card text-white shadow-xl bg-cover bg-center relative overflow-hidden"
      style={{ backgroundImage: 'url(/webp/parky-low.webp)', minHeight: '640px' }}
    >
      {/* Overlay for better text contrast */}
      <div className="absolute inset-0 bg-black/30" />
      <div className="card-body relative z-10">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="w-16 h-16 rounded-full bg-white/20" />
          <Skeleton className="w-24 h-8 rounded-lg bg-white/20" />
        </div>
        <Skeleton className="h-8 w-3/4 mb-2 bg-white/20" />
        <Skeleton className="h-6 w-full mb-4 bg-white/20" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-16 rounded-lg bg-white/20" />
          <Skeleton className="h-16 rounded-lg bg-white/20" />
        </div>
      </div>
    </div>
  );
};

export const SkeletonWeatherForecast: React.FC = () => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="card bg-base-100 shadow-sm">
          <div className="card-body p-3 space-y-2">
            <Skeleton className="h-4 w-16 mx-auto" />
            <Skeleton className="h-12 w-12 mx-auto rounded-full" />
            <Skeleton className="h-5 w-12 mx-auto" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
};

export const SkeletonActivityGrid: React.FC<{ count?: number }> = ({ count = 6 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonActivityCard key={i} />
      ))}
    </div>
  );
};

export const SkeletonHomePage: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">
      {/* Header Section */}
      <div className="text-center space-y-4">
        <Skeleton className="h-12 w-3/4 mx-auto" />
        <Skeleton className="h-6 w-1/2 mx-auto" />
      </div>

      {/* Location Selector */}
      <div className="flex justify-center">
        <Skeleton className="h-12 w-64 rounded-lg" />
      </div>

      {/* Hero Activity Card */}
      <SkeletonHeroCard />

      {/* Weather Forecast */}
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <SkeletonWeatherForecast />
      </div>

      {/* Activity Grid */}
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <SkeletonActivityGrid count={6} />
      </div>
    </div>
  );
};

export default Skeleton;

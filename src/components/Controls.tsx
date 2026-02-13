import { ButtonHTMLAttributes } from 'react';

interface ControlButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}

function ControlButton({ variant = 'primary', className, ...props }: ControlButtonProps) {
  const baseStyles = 'px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center gap-2';
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 shadow-md',
    secondary: 'bg-white text-gray-800 hover:bg-gray-100 border border-gray-200 shadow-sm dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700 dark:hover:bg-zinc-700',
    ghost: 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-800',
    danger: 'bg-red-500 text-white hover:bg-red-600 active:bg-red-700 shadow-md',
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${className || ''}`}
      {...props}
    />
  );
}

interface ControlsProps {
  onLike: () => void;
  onDislike: () => void;
  onSkip: () => void;
  onFavorite: () => void;
  onNext: () => void;
  disabled?: boolean;
}

export default function Controls({
  onLike,
  onDislike,
  onSkip,
  onFavorite,
  onNext,
  disabled
}: ControlsProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 p-4">
      <ControlButton onClick={onDislike} variant="secondary" disabled={disabled} title="Dislike">
        👎
      </ControlButton>
      <ControlButton onClick={onSkip} variant="ghost" disabled={disabled} title="Skip">
        Skip
      </ControlButton>
      <ControlButton onClick={onLike} variant="secondary" disabled={disabled} title="Like">
        👍
      </ControlButton>
      <ControlButton onClick={onFavorite} variant="secondary" disabled={disabled} title="Favorite">
        ❤️
      </ControlButton>
      <ControlButton onClick={onNext} variant="primary" disabled={disabled} title="Next Photo">
        Next ➡
      </ControlButton>
    </div>
  );
}

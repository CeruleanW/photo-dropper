import { ButtonHTMLAttributes } from 'react';
import { ThumbsUp, ThumbsDown, Heart, ArrowLeft, ArrowRight } from 'lucide-react';

interface ControlButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}

function ControlButton({ variant = 'primary', className, ...props }: ControlButtonProps) {
  const baseStyles = 'px-4 py-2 rounded-full font-medium transition-all duration-200 flex items-center justify-center gap-2 hover:scale-105 active:scale-95';
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg hover:shadow-blue-500/30',
    secondary: 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 shadow-md dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700 dark:hover:bg-zinc-700',
    ghost: 'text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-zinc-800 dark:hover:text-white',
    danger: 'bg-red-500 text-white hover:bg-red-600 shadow-lg hover:shadow-red-500/30',
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
  onFavorite: () => void;
  onPrev: () => void;
  onNext: () => void;
  disabled?: boolean;
  isLiked?: boolean;
  isFavorited?: boolean;
}

export default function Controls({
  onLike,
  onDislike,
  onFavorite,
  onPrev,
  onNext,
  disabled,
  isLiked = false,
  isFavorited = false,
}: ControlsProps) {
  return (
    <div className="flex items-center justify-center gap-6 p-6 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 dark:border-zinc-800/50">
      <ControlButton onClick={onDislike} variant="secondary" disabled={disabled} title="Dislike" className="w-12 h-12 !px-0">
        <ThumbsDown className="w-5 h-5" />
      </ControlButton>

      <ControlButton onClick={onLike} variant="secondary" disabled={disabled} title="Like" className={`w-14 h-14 !px-0 ${isLiked ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700' : 'text-gray-500 dark:text-gray-400'}`}>
        <ThumbsUp className={`w-6 h-6 ${isLiked ? 'fill-current' : ''}`} />
      </ControlButton>

      <ControlButton onClick={onFavorite} variant="secondary" disabled={disabled} title="Favorite" className={`w-12 h-12 !px-0 ${isFavorited ? 'text-red-500 bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700' : 'text-gray-500 dark:text-gray-400'}`}>
        <Heart className={`w-5 h-5 ${isFavorited ? 'fill-current' : ''}`} />
      </ControlButton>

      <div className="h-8 w-px bg-gray-200 dark:bg-zinc-700 mx-2" />

      <ControlButton onClick={onPrev} variant="secondary" disabled={disabled} title="Previous Photo">
        <ArrowLeft className="w-4 h-4" />
        <span>Prev</span>
      </ControlButton>

      <ControlButton onClick={onNext} variant="primary" disabled={disabled} title="Next Photo">
        <span>Next</span>
        <ArrowRight className="w-4 h-4" />
      </ControlButton>
    </div>
  );
}

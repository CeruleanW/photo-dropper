'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Photo, PhotoComment } from '@/types';

interface MetadataEditorProps {
  photo: Photo;
  onUpdate: (updatedPhoto: Photo) => void;
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const sec = Math.max(0, Math.floor(diff / 1000));
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function MetadataEditor({ photo, onUpdate }: MetadataEditorProps) {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;
  const [tagInput, setTagInput] = useState('');
  const [commentInput, setCommentInput] = useState('');
  const [descriptionInput, setDescriptionInput] = useState((photo.metadata as any)?.description || '');
  const [isTagsExpanded, setIsTagsExpanded] = useState(false);
  const [comments, setComments] = useState<PhotoComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [posting, setPosting] = useState(false);

  // Safely access tags from metadata
  const tags: string[] = (photo.metadata as any)?.tags || [];

  // Update local state when photo prop changes
  useEffect(() => {
    setDescriptionInput((photo.metadata as any)?.description || '');
  }, [photo._id, photo.metadata]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCommentsLoading(true);
      try {
        const res = await fetch(`/api/photos/${photo._id}/comments`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setComments(data.comments || []);
        } else if (!cancelled) {
          setComments([]);
        }
      } catch {
        if (!cancelled) setComments([]);
      } finally {
        if (!cancelled) setCommentsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [photo._id]);

  const handleSaveDescription = async () => {
    try {
      const res = await fetch(`/api/photos/${photo._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: descriptionInput }),
      });

      if (res.ok) {
        const data = await res.json();
        onUpdate(data.photo);
      }
    } catch (error) {
      console.error('Failed to save description', error);
    }
  };

  const handleAddTag = async () => {
    if (!tagInput.trim()) return;
    const newTags = [...tags, tagInput.trim()];

    try {
      const res = await fetch(`/api/photos/${photo._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: newTags }),
      });

      if (res.ok) {
        const data = await res.json();
        onUpdate(data.photo);
        setTagInput('');
      }
    } catch (error) {
      console.error('Failed to add tag', error);
    }
  };

  const handleAddComment = async () => {
    if (!commentInput.trim()) return;
    setPosting(true);
    try {
      const res = await fetch('/api/photos/interaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoId: photo._id,
          type: 'COMMENT',
          metadata: { text: commentInput.trim() },
        }),
      });

      if (res.ok) {
        setCommentInput('');
        const cRes = await fetch(`/api/photos/${photo._id}/comments`);
        if (cRes.ok) {
          const data = await cRes.json();
          setComments(data.comments || []);
        }
      }
    } catch (error) {
      console.error('Failed to add comment', error);
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="w-full max-w-lg mt-4 p-4 bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-700">
      <div className="flex justify-between items-center mb-2 cursor-pointer" onClick={() => setIsTagsExpanded(!isTagsExpanded)}>
        <h3 className="font-semibold text-gray-700 dark:text-gray-200">Tags & Comments</h3>
        <span className="text-sm text-gray-500">{isTagsExpanded ? '▲' : '▼'}</span>
      </div>

      {isTagsExpanded && (
        <div className="space-y-4">
          {/* Description Section */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Description</label>
            <div className="flex gap-2">
              <textarea
                value={descriptionInput}
                onChange={(e) => setDescriptionInput(e.target.value)}
                placeholder="Add a description..."
                rows={3}
                className="w-full px-3 py-2 text-sm border rounded bg-transparent dark:border-zinc-600 dark:text-white resize-none"
              />
            </div>
            {descriptionInput !== (photo.metadata as any)?.description && (
              <div className="flex justify-end mt-1">
                <button
                  onClick={handleSaveDescription}
                  className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition"
                >
                  Save Description
                </button>
              </div>
            )}
          </div>

          {/* Tags Section */}
          <div>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag, idx) => (
                <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full dark:bg-blue-900 dark:text-blue-200">
                  #{tag}
                </span>
              ))}
              {tags.length === 0 && <span className="text-gray-400 text-xs italic">No tags yet</span>}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Add a tag..."
                className="flex-1 px-3 py-1.5 text-sm border rounded bg-transparent dark:border-zinc-600 dark:text-white"
                onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
              />
              <button onClick={handleAddTag} className="px-3 py-1 bg-gray-200 hover:bg-gray-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 rounded text-sm">
                Add
              </button>
            </div>
          </div>

          {/* Comments Section */}
          <div className="pt-2 border-t border-gray-100 dark:border-zinc-700">
            {commentsLoading ? (
              <p className="text-xs text-gray-400 mb-2">Loading comments...</p>
            ) : comments.length > 0 ? (
              <ul className="flex flex-col gap-2 mb-2 max-h-48 overflow-y-auto">
                {comments.map((c) => {
                  const mine = !!(currentUserId && c.userId === currentUserId);
                  return (
                    <li
                      key={c._id}
                      className="flex flex-col gap-0.5 px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-zinc-900/60 border border-gray-100 dark:border-zinc-700"
                    >
                      <span className="text-sm text-gray-700 dark:text-gray-200 break-words whitespace-pre-wrap">{c.text}</span>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">
                        {mine ? 'You' : 'Guest'} · {timeAgo(c.createdAt)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-xs text-gray-400 italic mb-2">No comments yet</p>
            )}
            <textarea
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              placeholder="Write a comment..."
              rows={2}
              className="w-full px-3 py-2 text-sm border rounded bg-transparent dark:border-zinc-600 dark:text-white resize-none"
            />
            <div className="flex justify-end mt-1">
              <button
                onClick={handleAddComment}
                disabled={posting || !commentInput.trim()}
                className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {posting ? 'Posting...' : 'Post Comment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

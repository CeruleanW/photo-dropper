'use client';

import { useState, useEffect } from 'react';
import { Photo } from '@/types';

interface MetadataEditorProps {
  photo: Photo;
  onUpdate: (updatedPhoto: Photo) => void;
}

export default function MetadataEditor({ photo, onUpdate }: MetadataEditorProps) {
  const [tagInput, setTagInput] = useState('');
  const [commentInput, setCommentInput] = useState('');
  const [descriptionInput, setDescriptionInput] = useState((photo.metadata as any)?.description || '');
  const [isTagsExpanded, setIsTagsExpanded] = useState(false);

  // Safely access tags from metadata
  const tags: string[] = (photo.metadata as any)?.tags || [];

  // Update local state when photo prop changes
  useEffect(() => {
    setDescriptionInput((photo.metadata as any)?.description || '');
  }, [photo._id, photo.metadata]);

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

    try {
      const dummyUserId = '507f1f77bcf86cd799439011';
      await fetch('/api/photos/interaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: dummyUserId,
          photoId: photo._id,
          type: 'COMMENT',
          metadata: { text: commentInput.trim() }
        }),
      });

      // We don't necessarily update the photo object for comments unless we store them there.
      // But we could show a success message.
      setCommentInput('');
      alert('Comment added!');
    } catch (error) {
      console.error('Failed to add comment', error);
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
            <textarea
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              placeholder="Write a comment..."
              rows={2}
              className="w-full px-3 py-2 text-sm border rounded bg-transparent dark:border-zinc-600 dark:text-white resize-none"
            />
            <div className="flex justify-end mt-1">
              <button onClick={handleAddComment} className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
                Post Comment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

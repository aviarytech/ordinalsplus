import React, { useRef } from 'react';
import LinkedResourceList from '../LinkedResourceList';
import { LinkedResource } from 'ordinalsplus';

interface HtmlCompositionFormProps {
  html: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

const HtmlCompositionForm: React.FC<HtmlCompositionFormProps> = ({ html, onChange, onSubmit }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertAtCursor = (text: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      onChange(html + text);
      return;
    }
    const start = textarea.selectionStart ?? html.length;
    const end = textarea.selectionEnd ?? html.length;
    const newValue = html.slice(0, start) + text + html.slice(end);
    onChange(newValue);
    // Set cursor after inserted text
    requestAnimationFrame(() => {
      textarea.focus();
      const pos = start + text.length;
      textarea.selectionStart = textarea.selectionEnd = pos;
    });
  };

  const handleResourceSelect = (resource: LinkedResource) => {
    const placeholder = `<div data-resource-id="${resource.id || resource.inscriptionId}"></div>`;
    insertAtCursor(placeholder);
  };

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          HTML Content
        </label>
        <textarea
          ref={textareaRef}
          value={html}
          onChange={e => onChange(e.target.value)}
          className="w-full h-64 p-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono"
        />
      </div>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Insert Resource</h3>
        <LinkedResourceList onResourceSelect={handleResourceSelect} itemsPerPage={8} />
      </div>
      <div className="flex justify-end">
        <button
          type="submit"
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md"
        >
          Continue
        </button>
      </div>
    </form>
  );
};

export default HtmlCompositionForm;

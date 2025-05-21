import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import CreateHtmlPage from '../src/pages/CreateHtmlPage';

describe('CreateHtmlPage', () => {
  test('allows composing HTML before launching wizard', () => {
    render(<CreateHtmlPage />);
    expect(screen.getByText(/Create HTML/i)).toBeInTheDocument();
    const textarea = screen.getByLabelText(/HTML Content/i) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '<p>Hello</p>' } });
    expect(textarea.value).toBe('<p>Hello</p>');
  });
});

import React from 'react';
import { render, screen } from '@testing-library/react';
import CreateHtmlPage from '../src/pages/CreateHtmlPage';

describe('CreateHtmlPage', () => {
  test('renders HTML inscription wizard with default content type', () => {
    render(<CreateHtmlPage />);
    expect(screen.getByText(/Create HTML Inscription/i)).toBeInTheDocument();
    const select = screen.getByLabelText(/Content Type/i) as HTMLSelectElement;
    expect(select.value).toBe('text/html');
  });
});

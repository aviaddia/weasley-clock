import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import WeasleyClock, { LOCATIONS } from '../components/WeasleyClock';

describe('WeasleyClock › structure', () => {
  it('renders an SVG element', () => {
    const { container } = render(<WeasleyClock locations={[]} />);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('renders all 8 location labels', () => {
    render(<WeasleyClock locations={[]} />);
    for (const loc of LOCATIONS) {
      expect(screen.getByText(loc)).toBeInTheDocument();
    }
  });

  it('shows empty-state hint when no people tracked', () => {
    render(<WeasleyClock locations={[]} />);
    expect(screen.getByText(/add family members/i)).toBeInTheDocument();
  });

  it('does not show empty-state hint when people are present', () => {
    const locations = [{ id: '1', name: 'Ron', imageUrl: null, location: 'Home' }];
    render(<WeasleyClock locations={locations} />);
    expect(screen.queryByText(/add family members/i)).toBeNull();
  });

  it('renders a title tooltip for each person hand', () => {
    const locations = [
      { id: '1', name: 'Ron', imageUrl: null, location: 'Home' },
      { id: '2', name: 'Hermione', imageUrl: null, location: 'Work' },
    ];
    const { container } = render(<WeasleyClock locations={locations} />);
    const titles = container.querySelectorAll('title');
    // Each PersonHand renders a <title> element
    const personTitles = Array.from(titles).filter((t) =>
      t.textContent.includes('–')
    );
    expect(personTitles).toHaveLength(2);
  });
});

describe('LOCATIONS constant', () => {
  it('has 8 entries', () => {
    expect(LOCATIONS).toHaveLength(8);
  });

  it('contains Home', () => {
    expect(LOCATIONS).toContain('Home');
  });

  it('contains Mortal Peril', () => {
    expect(LOCATIONS).toContain('Mortal Peril');
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AddPersonModal from '../components/AddPersonModal';

function renderModal(overrides = {}) {
  const props = {
    onClose: vi.fn(),
    onSubmit: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  render(<AddPersonModal {...props} />);
  return props;
}

describe('AddPersonModal › rendering', () => {
  it('renders the modal title', () => {
    renderModal();
    expect(screen.getByText('Add Family Member')).toBeInTheDocument();
  });

  it('renders name, phone inputs and a submit button', () => {
    renderModal();
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/phone/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add to clock/i })).toBeInTheDocument();
  });
});

describe('AddPersonModal › validation', () => {
  it('shows error when submitted with empty name', async () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /add to clock/i }));
    await waitFor(() =>
      expect(screen.getByText(/name is required/i)).toBeInTheDocument()
    );
  });

  it('shows error when submitted with name but no phone', async () => {
    renderModal();
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: 'Ron Weasley' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add to clock/i }));
    await waitFor(() =>
      expect(screen.getByText(/phone.*required/i)).toBeInTheDocument()
    );
  });
});

describe('AddPersonModal › interactions', () => {
  it('calls onClose when Cancel is clicked', () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when overlay is clicked', () => {
    const { onClose } = renderModal();
    // The overlay has class "modal-overlay"
    const overlay = document.querySelector('.modal-overlay');
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onSubmit with FormData when form is valid', async () => {
    const { onSubmit, onClose } = renderModal();
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: 'Harry Potter' },
    });
    fireEvent.change(screen.getByLabelText(/phone/i), {
      target: { value: '+447911000001' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add to clock/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onClose).toHaveBeenCalledOnce();
    const [formData] = onSubmit.mock.calls[0];
    expect(formData.get('name')).toBe('Harry Potter');
    expect(formData.get('phone')).toBe('+447911000001');
  });

  it('shows backend error message when onSubmit rejects', async () => {
    renderModal({
      onSubmit: vi.fn().mockRejectedValue(new Error('Phone unreachable')),
    });
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: 'Dobby' },
    });
    fireEvent.change(screen.getByLabelText(/phone/i), {
      target: { value: '+447911000002' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add to clock/i }));
    await waitFor(() =>
      expect(screen.getByText('Phone unreachable')).toBeInTheDocument()
    );
  });
});

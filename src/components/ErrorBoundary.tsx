/**
 * ErrorBoundary — the last thing between a thrown render and a white page.
 *
 * Without one, any exception inside any panel unmounts the whole tree and the
 * reader is left with a blank tab and no idea whether the server is down, the
 * data is wrong, or they clicked something unlucky. On a machine inside a
 * hospital network, with no error reporting and nobody watching a console,
 * that failure is silent and total.
 *
 * So: say that it broke, say what broke, and offer the two things that
 * actually recover it — go back to the whole cohort, or reload. The message is
 * deliberately plain about the data being untouched, because the first worry
 * on seeing a crash in a research tool is whether the numbers are wrong.
 */
import { Component, ErrorInfo, ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // No telemetry leaves this machine — the console is the only sink, and it
    // is what a maintainer will be asked to paste.
    console.error('Germany Imaging Atlas crashed while rendering:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div role="alert" style={{
        position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24, background: 'var(--color-bg, #F4F5F7)',
        fontFamily: 'Inter, system-ui, sans-serif', color: 'var(--color-text-main, #1A1D21)',
      }}>
        <div style={{
          maxWidth: 560, background: 'var(--color-surface, #fff)', borderRadius: 14,
          border: '1px solid var(--color-border, #E2E5EA)', padding: '26px 28px',
          boxShadow: '0 10px 40px rgba(16,32,30,0.12)',
        }}>
          <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 8 }}>
            The atlas stopped drawing
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--color-text-muted, #5F6B7A)' }}>
            Something in the interface threw an error. The data itself is not affected —
            it is a static file, and nothing here writes to it. Reloading starts a fresh
            session; your saved groups are kept.
          </div>
          <pre style={{
            marginTop: 14, padding: '10px 12px', borderRadius: 8, overflowX: 'auto',
            background: 'var(--color-bg, #F4F5F7)', border: '1px solid var(--color-border, #E2E5EA)',
            fontSize: 11.5, whiteSpace: 'pre-wrap', color: 'var(--color-text-main, #1A1D21)',
          }}>{String(error.message || error)}</pre>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: '9px 16px', borderRadius: 9, border: 'none', cursor: 'pointer',
                background: 'var(--color-primary, #2F8E84)', color: '#fff', fontSize: 13, fontWeight: 700,
              }}
            >Reload the atlas</button>
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              style={{
                padding: '9px 16px', borderRadius: 9, cursor: 'pointer',
                border: '1px solid var(--color-border, #E2E5EA)',
                background: 'var(--color-surface, #fff)', fontSize: 13, fontWeight: 600,
              }}
            >Try to carry on</button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted, #5F6B7A)', marginTop: 14 }}>
            If it keeps happening, the browser console holds the full trace, and the
            build identifier is at <code>/build.json</code>.
          </div>
        </div>
      </div>
    );
  }
}

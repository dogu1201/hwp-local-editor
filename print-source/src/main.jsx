import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import init, { HwpDocument } from '@rhwp/core';
import './styles.css';

function registerTextMeasure() {
  let ctx = null;
  let lastFont = '';
  globalThis.measureTextWidth = (font, text) => {
    if (!ctx) ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return String(text).length * 8;
    if (font !== lastFont) {
      ctx.font = font;
      lastFont = font;
    }
    return ctx.measureText(text).width;
  };
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function App() {
  const inputRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('렌더러를 준비하는 중입니다…');
  const [documents, setDocuments] = useState([]);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        registerTextMeasure();
        await init({ module_or_path: new URL('rhwp_bg.wasm', document.baseURI).href });
        if (active) {
          setReady(true);
          setStatus('HWP/HWPX 파일을 선택하세요. 여러 개를 한 번에 추가할 수 있습니다.');
        }
      } catch (e) {
        console.error(e);
        if (active) {
          setError('rhwp 렌더러 초기화에 실패했습니다. 인터넷 연결을 확인한 뒤 페이지를 새로고침하세요.');
          setStatus('초기화 실패');
        }
      }
    })();
    return () => { active = false; };
  }, []);

  const selectedCount = documents.filter((doc) => doc.selected && doc.status === 'done').length;
  const selectedPages = documents
    .filter((doc) => doc.selected && doc.status === 'done')
    .reduce((sum, doc) => sum + doc.pages.length, 0);

  async function addFiles(fileList) {
    if (!ready) return;
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    const valid = [];
    const invalid = [];
    const existingNames = new Set(documents.map((doc) => doc.name));

    for (const file of files) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!['hwp', 'hwpx'].includes(ext)) {
        invalid.push(file.name);
      } else if (existingNames.has(file.name)) {
        invalid.push(`${file.name} (이미 추가됨)`);
      } else {
        valid.push(file);
        existingNames.add(file.name);
      }
    }

    if (invalid.length > 0) {
      setError(`추가하지 못한 파일: ${invalid.join(', ')}`);
    } else {
      setError('');
    }

    if (valid.length === 0) return;

    const queued = valid.map((file) => ({
      id: createId(),
      name: file.name,
      file,
      selected: true,
      status: 'loading',
      pages: [],
      error: '',
    }));

    setDocuments((prev) => [...prev, ...queued]);
    setStatus(`${valid.length}개 문서를 추가했습니다. 순서대로 렌더링합니다…`);

    for (const item of queued) {
      try {
        const bytes = new Uint8Array(await item.file.arrayBuffer());
        const doc = new HwpDocument(bytes);
        const count = doc.pageCount();
        const rendered = [];
        for (let i = 0; i < count; i += 1) {
          rendered.push(doc.renderPageSvg(i));
        }
        setDocuments((prev) => prev.map((d) => (
          d.id === item.id ? { ...d, status: 'done', pages: rendered } : d
        )));
      } catch (e) {
        console.error(e);
        setDocuments((prev) => prev.map((d) => (
          d.id === item.id
            ? {
                ...d,
                status: 'error',
                error: '이 문서를 렌더링하지 못했습니다. rhwp가 지원하지 않는 HWP 기능일 수 있습니다.',
              }
            : d
        )));
      }
    }

    setStatus('문서 렌더링이 완료되었습니다. 인쇄할 파일을 체크하세요.');
  }

  function toggleDocument(id) {
    setDocuments((prev) => prev.map((doc) => (
      doc.id === id ? { ...doc, selected: !doc.selected } : doc
    )));
  }

  function removeDocument(id) {
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
  }

  function toggleAll(value) {
    setDocuments((prev) => prev.map((doc) => (
      doc.status === 'done' ? { ...doc, selected: value } : doc
    )));
  }

  function removeSelected() {
    const selectedIds = new Set(documents.filter((doc) => doc.selected).map((doc) => doc.id));
    if (selectedIds.size === 0) {
      setError('제거할 문서를 하나 이상 체크하세요.');
      return;
    }
    setDocuments((prev) => prev.filter((doc) => !selectedIds.has(doc.id)));
    setError('');
    setStatus(`${selectedIds.size}개 문서를 목록에서 제거했습니다.`);
  }

  function clearAll() {
    setDocuments([]);
    setError('');
    setStatus('HWP/HWPX 파일을 선택하세요. 여러 개를 한 번에 추가할 수 있습니다.');
    if (inputRef.current) inputRef.current.value = '';
  }

  function printSelected() {
    if (selectedCount === 0) {
      setError('인쇄할 문서를 하나 이상 체크하세요.');
      return;
    }
    setError('');
    window.print();
  }

  const allDoneSelected = documents.filter((doc) => doc.status === 'done').length > 0
    && documents.filter((doc) => doc.status === 'done').every((doc) => doc.selected);

  return (
    <main className="app-shell">
      <header className="topbar no-print">
        <div>
          <h1>HWP 바로인쇄</h1>
          <p>여러 문서를 추가한 뒤 원하는 파일만 체크해서 한 번에 인쇄할 수 있습니다.</p>
        </div>
        {documents.length > 0 && (
          <div className="actions">
            <button className="secondary" onClick={() => inputRef.current?.click()}>파일 추가</button>
            <button className="secondary" onClick={clearAll}>전체 제거</button>
            <button className="primary" onClick={printSelected} disabled={selectedCount === 0}>
              선택 인쇄 ({selectedCount})
            </button>
          </div>
        )}
      <a href="../app/" target="_blank" rel="noopener noreferrer" className="secondary">HWP 편집기 열기 ↗</a></header>

      <section className="statusbar no-print">
        <span className={`dot ${ready ? 'ok' : ''}`} />
        <span>{status}</span>
      </section>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".hwp,.hwpx,application/x-hwp"
        hidden
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {documents.length === 0 ? (
        <section
          className={`dropzone no-print ${dragging ? 'dragging' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            addFiles(e.dataTransfer.files);
          }}
          onClick={() => ready && inputRef.current?.click()}
        >
          <div className="file-icon">HWP</div>
          <h2>HWP 파일을 여기에 놓으세요</h2>
          <p>여러 개의 HWP/HWPX 파일을 한 번에 선택하거나 드래그할 수 있습니다.</p>
          <button className="primary" disabled={!ready}>여러 파일 선택</button>
        </section>
      ) : (
        <>
          <aside className="warning no-print">
            <strong>인쇄 전 확인</strong>
            <span>PC에 원본 문서의 폰트가 없으면 글자 폭·줄바꿈이 달라질 수 있습니다. 미리보기에서 표와 페이지 나눔을 확인하세요.</span>
          </aside>

          <section className="batch-panel no-print">
            <div className="batch-header">
              <div>
                <h2>인쇄 파일 선택</h2>
                <p>{documents.length}개 추가됨 · {selectedCount}개 선택 · {selectedPages}페이지 인쇄 예정</p>
              </div>
              <div className="batch-actions">
                <label className="select-all">
                  <input
                    type="checkbox"
                    checked={allDoneSelected}
                    onChange={(e) => toggleAll(e.target.checked)}
                  />
                  전체 선택
                </label>
                <button className="secondary small" onClick={() => toggleAll(false)}>전체 해제</button>
                <button className="secondary small danger-outline" onClick={removeSelected} disabled={selectedCount === 0}>선택 제거</button>
              </div>
            </div>

            <div className="file-list">
              {documents.map((doc, index) => (
                <div className={`file-row ${doc.selected ? 'selected' : ''}`} key={doc.id}>
                  <label className="file-check">
                    <input
                      type="checkbox"
                      checked={doc.selected}
                      disabled={doc.status !== 'done'}
                      onChange={() => toggleDocument(doc.id)}
                    />
                  </label>
                  <div className="file-order">{index + 1}</div>
                  <div className="file-info">
                    <strong>{doc.name}</strong>
                    {doc.status === 'loading' && <span className="file-status loading">렌더링 중…</span>}
                    {doc.status === 'done' && <span className="file-status ok">{doc.pages.length}페이지</span>}
                    {doc.status === 'error' && <span className="file-status error-text">{doc.error}</span>}
                  </div>
                  <button className="remove-button" onClick={() => removeDocument(doc.id)} aria-label={`${doc.name} 제거`}>제거</button>
                </div>
              ))}
            </div>

            <div className="print-summary">
              <span>체크된 파일만 현재 목록 순서대로 하나의 인쇄 작업으로 출력됩니다.</span>
              <button className="primary" onClick={printSelected} disabled={selectedCount === 0}>
                선택한 {selectedCount}개 파일 인쇄
              </button>
            </div>
          </section>

          <section id="viewer" className="viewer" aria-label="HWP 문서 미리보기">
            {documents.map((doc) => (
              <section
                className={`document-group ${doc.selected && doc.status === 'done' ? 'print-selected' : 'print-excluded'}`}
                key={doc.id}
              >
                {doc.status === 'done' && (
                  <>
                    <div className="document-title no-print">
                      <div>
                        <span className="doc-badge">문서</span>
                        <strong>{doc.name}</strong>
                      </div>
                      <span>{doc.pages.length}페이지 · {doc.selected ? '인쇄 대상' : '인쇄 제외'}</span>
                    </div>
                    {doc.pages.map((svg, pageIndex) => (
                      <article className="paper" key={pageIndex}>
                        <div className="page-number no-print">{pageIndex + 1} / {doc.pages.length}</div>
                        <div className="svg-page" dangerouslySetInnerHTML={{ __html: svg }} />
                      </article>
                    ))}
                  </>
                )}
              </section>
            ))}
          </section>
        </>
      )}

      {error && <div className="error no-print">{error}</div>}

      <footer className="site-footer no-print">
        <div className="footer-inner">
          <p>
            이 서비스는 독립적으로 개발된 HWP/HWPX 문서 열람·인쇄 도구이며,
            한글과컴퓨터와 제휴, 후원 또는 승인 관계가 없습니다.
          </p>
          <p>
            “한글”, “한컴”, “HWP”, “HWPX” 등 관련 상표와 명칭의 권리는 각 권리자에게 있습니다.
          </p>
          <p>
            문서 처리에 오픈소스 소프트웨어 <strong>@rhwp/core</strong>를 사용합니다.
            배포 시 적용되는 오픈소스 고지는 프로젝트의 <code>THIRD_PARTY_NOTICES.md</code>를 확인하세요.
          </p>
          <p>
            현재 버전은 선택한 문서를 사용자의 브라우저 메모리에서 처리하며,
            별도의 업로드 API나 데이터베이스로 문서를 전송하거나 저장하지 않습니다.
          </p>
        </div>
      </footer>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);

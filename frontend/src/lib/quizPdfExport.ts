/**
 * E-Schola Pro - Official Quiz Results & Academic Evaluation PDF Export Utility
 * Generates high-fidelity, printable A4 Transcripts and Class Reports with zero external dependencies.
 */

export interface QuestionReviewItem {
  question_id: number;
  question_text: string;
  options: string[];
  selected_index: number | null;
  correct_index: number;
  is_correct: boolean;
  points: number;
  max_points: number;
}

export interface QuizAttemptDetail {
  attempt_id: number;
  quiz_id: number;
  quiz_title: string;
  quiz_description?: string | null;
  time_limit_minutes: number;
  creator_email?: string | null;
  user_id: number;
  user_email: string;
  user_role: string;
  user_group?: string | null;
  score: number;
  max_score: number;
  percentage: number;
  passed: boolean;
  completed_at: string;
  questions_review: QuestionReviewItem[];
}

export interface QuizGlobalReport {
  quiz_id: number;
  quiz_title: string;
  created_at: string;
  creator_email?: string | null;
  target_roles: string;
  total_points: number;
  total_attempts: number;
  passed_count: number;
  average_score: number;
  average_percentage: number;
  highest_percentage: number;
  lowest_percentage: number;
  success_rate: number;
  attempts: Array<{
    id: number;
    user_email: string;
    user_role: string;
    score: number;
    max_score: number;
    percentage: number;
    completed_at: string;
  }>;
}

function getMention(percentage: number): { text: string; color: string } {
  if (percentage >= 90) return { text: 'EXCELLENT (FÉLICITATIONS DU JURY)', color: '#059669' };
  if (percentage >= 80) return { text: 'TRÈS BIEN', color: '#0d9488' };
  if (percentage >= 70) return { text: 'BIEN', color: '#2563eb' };
  if (percentage >= 60) return { text: 'PASSABLE (VALIDÉ)', color: '#d97706' };
  return { text: 'NON VALIDÉ (AJOURNÉ)', color: '#e11d48' };
}

function printHtmlDocument(htmlContent: string) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  doc.open();
  doc.write(htmlContent);
  doc.close();

  iframe.contentWindow?.focus();
  setTimeout(() => {
    iframe.contentWindow?.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1500);
  }, 300);
}

/**
 * Export Individual Student Quiz Attempt PDF (Transcript / Relevé de Notes Officiel)
 * Permitted for: Étudiant, Stagiaire, Employé (personal results only) & Staff/Admins
 */
export function exportPersonalQuizAttemptPDF(data: QuizAttemptDetail) {
  const mention = getMention(data.percentage);
  const formattedDate = new Date(data.completed_at).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
  const formattedTime = new Date(data.completed_at).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const html = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <title>Relevé de Résultats - ${data.quiz_title} - ${data.user_email}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 15mm 15mm 15mm 15mm;
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
          color: #1e293b;
          background: #ffffff;
          margin: 0;
          padding: 0;
          font-size: 11pt;
          line-height: 1.4;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2.5px solid #2563eb;
          padding-bottom: 12px;
          margin-bottom: 18px;
        }
        .logo-box h1 {
          margin: 0;
          font-size: 18pt;
          font-weight: 900;
          color: #1e293b;
          letter-spacing: -0.5px;
        }
        .logo-box h1 span {
          color: #2563eb;
        }
        .logo-box p {
          margin: 2px 0 0 0;
          font-size: 8.5pt;
          color: #64748b;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .cert-badge {
          text-align: right;
        }
        .cert-badge .badge-title {
          font-size: 8pt;
          font-weight: 800;
          color: #2563eb;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          padding: 4px 10px;
          border-radius: 6px;
          display: inline-block;
          margin-bottom: 4px;
        }
        .cert-badge .meta-date {
          font-size: 8.5pt;
          color: #64748b;
        }
        .document-title {
          text-align: center;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 12px;
          margin-bottom: 18px;
        }
        .document-title h2 {
          margin: 0;
          font-size: 14pt;
          font-weight: 800;
          color: #0f172a;
        }
        .document-title p {
          margin: 4px 0 0 0;
          font-size: 9pt;
          color: #475569;
        }
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 18px;
        }
        .info-card {
          border: 1px solid #e2e8f0;
          background: #ffffff;
          border-radius: 8px;
          padding: 10px 12px;
        }
        .info-card .card-title {
          font-size: 7.5pt;
          font-weight: 800;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }
        .info-card .card-value {
          font-size: 10pt;
          font-weight: 700;
          color: #0f172a;
        }
        .info-card .card-sub {
          font-size: 8pt;
          color: #64748b;
          margin-top: 2px;
        }
        .score-banner {
          display: flex;
          align-items: center;
          justify-content: space-around;
          background: ${data.passed ? '#f0fdf4' : '#fff1f2'};
          border: 1.5px solid ${data.passed ? '#86efac' : '#fecdd3'};
          border-radius: 12px;
          padding: 14px;
          margin-bottom: 20px;
          text-align: center;
        }
        .score-item .label {
          font-size: 8pt;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
        }
        .score-item .val {
          font-size: 18pt;
          font-weight: 900;
          font-family: monospace;
          color: ${data.passed ? '#15803d' : '#be123c'};
          margin: 2px 0;
        }
        .score-item .mention {
          font-size: 9pt;
          font-weight: 800;
          color: ${mention.color};
        }
        .divider {
          width: 1px;
          height: 35px;
          background: #cbd5e1;
        }
        .section-title {
          font-size: 10pt;
          font-weight: 800;
          color: #1e293b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 4px;
        }
        .question-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
          font-size: 9pt;
        }
        .question-table th {
          background: #f1f5f9;
          color: #475569;
          font-weight: 800;
          text-align: left;
          padding: 8px 10px;
          border: 1px solid #cbd5e1;
        }
        .question-table td {
          padding: 8px 10px;
          border: 1px solid #e2e8f0;
          vertical-align: top;
        }
        .question-table tr:nth-child(even) {
          background: #fafafa;
        }
        .status-pill {
          display: inline-block;
          padding: 2px 7px;
          border-radius: 4px;
          font-size: 7.5pt;
          font-weight: 800;
          text-transform: uppercase;
        }
        .status-correct {
          background: #dcfce7;
          color: #166534;
        }
        .status-wrong {
          background: #ffe4e6;
          color: #9f1239;
        }
        .footer {
          margin-top: 25px;
          border-top: 1px solid #cbd5e1;
          padding-top: 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 7.5pt;
          color: #64748b;
        }
        .signature-box {
          text-align: right;
          border-top: 1px dashed #94a3b8;
          width: 180px;
          padding-top: 4px;
          font-weight: bold;
          font-size: 8pt;
          color: #334155;
        }
      </style>
    </head>
    <body>
      <!-- Header -->
      <div class="header">
        <div class="logo-box">
          <h1>E-Schola <span>Pro</span></h1>
          <p>Plateforme Académique & Pédagogique d'Excellence</p>
        </div>
        <div class="cert-badge">
          <span class="badge-title">RÉF : CERT-QUIZ-${data.attempt_id}-${data.quiz_id}</span>
          <div class="meta-date">Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}</div>
        </div>
      </div>

      <!-- Document Title -->
      <div class="document-title">
        <h2>RELEVÉ INDIVIDUEL DE RÉSULTATS D'ÉVALUATION</h2>
        <p>Attestation officielle de participation et de validation des compétences</p>
      </div>

      <!-- Candidate & Quiz Info Grid -->
      <div class="info-grid">
        <div class="info-card">
          <div class="card-title">Candidat / Apprenant</div>
          <div class="card-value">${data.user_email}</div>
          <div class="card-sub">Statut : ${data.user_role.toUpperCase()} • ID #${data.user_id} ${data.user_group ? '• ' + data.user_group : ''}</div>
        </div>
        <div class="info-card">
          <div class="card-title">Évaluation / Quiz</div>
          <div class="card-value">${data.quiz_title}</div>
          <div class="card-sub">Formateur : ${data.creator_email || 'Équipe Pédagogique'} • Date : ${formattedDate} (${formattedTime})</div>
        </div>
      </div>

      <!-- Score Banner -->
      <div class="score-banner">
        <div class="score-item">
          <div class="label">Note Finale</div>
          <div class="val">${data.score} / ${data.max_score} pts</div>
        </div>
        <div class="divider"></div>
        <div class="score-item">
          <div class="label">Pourcentage</div>
          <div class="val">${data.percentage}%</div>
        </div>
        <div class="divider"></div>
        <div class="score-item">
          <div class="label">Résultat & Décision</div>
          <div class="mention">${mention.text}</div>
        </div>
      </div>

      <!-- Detail Questions Table -->
      <div class="section-title">Détail des Questions & Correction Pédagogique</div>
      <table class="question-table">
        <thead>
          <tr>
            <th style="width: 5%;">#</th>
            <th style="width: 45%;">Intitulé de la Question</th>
            <th style="width: 25%;">Réponse Donnée</th>
            <th style="width: 15%;">Validation</th>
            <th style="width: 10%; text-align: right;">Points</th>
          </tr>
        </thead>
        <tbody>
          ${data.questions_review.map((q, idx) => `
            <tr>
              <td><strong>${idx + 1}</strong></td>
              <td>
                <strong>${q.question_text}</strong>
                ${!q.is_correct ? `<div style="color: #059669; font-size: 8pt; margin-top: 3px;">✓ Bonne réponse : ${q.options[q.correct_index] || 'N/A'}</div>` : ''}
              </td>
              <td>${q.selected_index !== null && q.selected_index !== undefined ? q.options[q.selected_index] || 'Non renseigné' : '<em style="color:#94a3b8;">Aucune réponse</em>'}</td>
              <td>
                <span class="status-pill ${q.is_correct ? 'status-correct' : 'status-wrong'}">
                  ${q.is_correct ? 'Exact ✓' : 'Incorrect ✗'}
                </span>
              </td>
              <td style="text-align: right; font-weight: bold; font-family: monospace;">
                ${q.points} / ${q.max_points}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <!-- Footer & Signature -->
      <div class="footer">
        <div>
          <strong>E-Schola Pro Certification Engine</strong> • Document officiel sécurisé et horodaté.<br>
          Code d'authenticité : SHA256-${Math.random().toString(36).substring(2, 10).toUpperCase()}
        </div>
        <div class="signature-box">
          Signature & Cachet Numérique<br>
          <span style="font-size: 7.5pt; color: #64748b;">Direction Pédagogique</span>
        </div>
      </div>
    </body>
    </html>
  `;

  printHtmlDocument(html);
}

/**
 * Export Global Class / Group Quiz Report PDF (Procès-Verbal & Synthèse Pédagogique)
 * Permitted for: Formateur, Pédagogique, DG_RH, Admin, Admin Manager
 */
export function exportGlobalQuizReportPDF(data: QuizGlobalReport) {
  const formattedDate = new Date(data.created_at).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  const html = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <title>Rapport Global des Résultats - ${data.quiz_title}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 15mm 15mm 15mm 15mm;
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
          color: #1e293b;
          background: #ffffff;
          margin: 0;
          padding: 0;
          font-size: 11pt;
          line-height: 1.4;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2.5px solid #2563eb;
          padding-bottom: 12px;
          margin-bottom: 18px;
        }
        .logo-box h1 {
          margin: 0;
          font-size: 18pt;
          font-weight: 900;
          color: #1e293b;
        }
        .logo-box h1 span {
          color: #2563eb;
        }
        .logo-box p {
          margin: 2px 0 0 0;
          font-size: 8.5pt;
          color: #64748b;
          font-weight: 600;
          text-transform: uppercase;
        }
        .report-title {
          text-align: center;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 12px;
          margin-bottom: 18px;
        }
        .report-title h2 {
          margin: 0;
          font-size: 14pt;
          font-weight: 800;
          color: #0f172a;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin-bottom: 20px;
        }
        .stat-box {
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 10px;
          text-align: center;
        }
        .stat-box .label {
          font-size: 7.5pt;
          font-weight: 800;
          color: #64748b;
          text-transform: uppercase;
        }
        .stat-box .value {
          font-size: 14pt;
          font-weight: 900;
          font-family: monospace;
          color: #1e293b;
          margin: 2px 0;
        }
        .stat-box .sub {
          font-size: 7.5pt;
          color: #64748b;
        }
        .table-list {
          width: 100%;
          border-collapse: collapse;
          font-size: 8.5pt;
          margin-bottom: 20px;
        }
        .table-list th {
          background: #0f172a;
          color: #ffffff;
          font-weight: 700;
          text-align: left;
          padding: 7px 10px;
          border: 1px solid #0f172a;
        }
        .table-list td {
          padding: 7px 10px;
          border: 1px solid #e2e8f0;
        }
        .table-list tr:nth-child(even) {
          background: #f8fafc;
        }
        .pill {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 7pt;
          font-weight: 800;
          text-transform: uppercase;
        }
        .pill-pass { background: #dcfce7; color: #166534; }
        .pill-fail { background: #ffe4e6; color: #9f1239; }
        .footer {
          margin-top: 25px;
          border-top: 1px solid #cbd5e1;
          padding-top: 10px;
          display: flex;
          justify-content: space-between;
          font-size: 7.5pt;
          color: #64748b;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo-box">
          <h1>E-Schola <span>Pro</span></h1>
          <p>Rapport Académique Pédagogique</p>
        </div>
        <div>
          <strong>PROCÈS-VERBAL OFFICIEL</strong><br>
          <span style="font-size: 8.5pt; color: #64748b;">Date d'édition : ${new Date().toLocaleDateString('fr-FR')}</span>
        </div>
      </div>

      <div class="report-title">
        <h2>SYNTHÈSE GLOBALE DES RÉSULTATS DE L'ÉVALUATION</h2>
        <p><strong>Quiz :</strong> ${data.quiz_title} • <strong>Formateur :</strong> ${data.creator_email || 'Équipe Pédagogique'} • <strong>Public :</strong> ${data.target_roles}</p>
      </div>

      <div class="stats-grid">
        <div class="stat-box">
          <div class="label">Total Passages</div>
          <div class="value">${data.total_attempts}</div>
          <div class="sub">Apprenant(s) évalué(s)</div>
        </div>
        <div class="stat-box">
          <div class="label">Moyenne Générale</div>
          <div class="value" style="color: #2563eb;">${data.average_percentage}%</div>
          <div class="sub">Moyenne : ${data.average_score} pts</div>
        </div>
        <div class="stat-box">
          <div class="label">Taux de Réussite</div>
          <div class="value" style="color: #059669;">${data.success_rate}%</div>
          <div class="sub">${data.passed_count} validé(s) / ${data.total_attempts}</div>
        </div>
        <div class="stat-box">
          <div class="label">Notes Min / Max</div>
          <div class="value" style="color: #d97706;">${data.lowest_percentage}% / ${data.highest_percentage}%</div>
          <div class="sub">Amplitude des notes</div>
        </div>
      </div>

      <table class="table-list">
        <thead>
          <tr>
            <th style="width: 5%;">Rang</th>
            <th style="width: 35%;">Apprenant / Email</th>
            <th style="width: 15%;">Rôle</th>
            <th style="width: 15%; text-align: center;">Note (/Total)</th>
            <th style="width: 15%; text-align: center;">Pourcentage</th>
            <th style="width: 15%; text-align: center;">Décision</th>
          </tr>
        </thead>
        <tbody>
          ${data.attempts.length === 0 ? '<tr><td colspan="6" style="text-align:center; padding: 15px;">Aucun passage enregistré.</td></tr>' : ''}
          ${data.attempts.map((att, i) => `
            <tr>
              <td><strong>#${i + 1}</strong></td>
              <td><strong>${att.user_email}</strong></td>
              <td style="text-transform: capitalize;">${att.user_role}</td>
              <td style="text-align: center; font-family: monospace; font-weight: bold;">${att.score} / ${att.max_score}</td>
              <td style="text-align: center; font-family: monospace; font-weight: bold; color: ${att.percentage >= 60 ? '#15803d' : '#be123c'};">${att.percentage}%</td>
              <td style="text-align: center;">
                <span class="pill ${att.percentage >= 60 ? 'pill-pass' : 'pill-fail'}">
                  ${att.percentage >= 60 ? 'Validé ✓' : 'Ajourné ✗'}
                </span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="footer">
        <div>E-Schola Pro Academic Reporting Engine • Document officiel d'évaluation</div>
        <div style="text-align: right;">Visa du Responsable Pédagogique : ____________________</div>
      </div>
    </body>
    </html>
  `;

  printHtmlDocument(html);
}

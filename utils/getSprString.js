// Mirrors the "SPR Email.html" mockup styling used by the frontend's ReviewScreen,
// so the emailed report looks like what the user already previewed before submitting.
const INK = '#14181d';
const MUTED = '#6b7480';
const MUTED_LIGHT = '#b6bdc7';
const BORDER = '#e7eaef';
const HAIRLINE = '#eef0f4';
const ROW_BORDER = '#f2f3f6';
const ZEBRA_BG = '#f4f5f7';
const ACCENT_BLUE = '#2f55e0';
const ACCENT_BLUE_LIGHT = '#dbe3fb';
const TRACK_BG = '#e4e8ee';
const MASTHEAD_BG = '#14181d';
const MASTHEAD_MUTED = '#97a0ac';
const MASTHEAD_SUB = '#aeb6c0';
const GREEN = '#16794a';
const STRIKE_MUTED = '#a1a1aa';

const SANS = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
const MONO = "ui-monospace, Consolas, 'Courier New', monospace";

const VOYAGE_UNDERWAY_COLOR = 'oklch(94.5% 0.129 101.54)';
const VOYAGE_COMPLETE_COLOR = 'oklch(79.2% 0.209 151.711)';

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

const css = (styles) =>
  Object.entries(styles)
    .filter(([, v]) => v !== undefined && v !== null && v !== false && v !== '')
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}:${v}`)
    .join(';');

const emptyDash = (color = MUTED_LIGHT) =>
  `<span style="${css({color, fontWeight: 400})}">&mdash;</span>`;

const orDash = (value) => (value ? escapeHtml(value) : emptyDash());

// Report data is client-supplied, so tolerate missing/null fields instead of throwing.
const text = (value) => String(value ?? '').trim();
const obj = (value) => (value && typeof value === 'object' ? value : {});
const rows = (value) => (Array.isArray(value) ? value.filter((row) => row && typeof row === 'object') : []);

const cleanRecipients = (list) =>
  (Array.isArray(list) ? list : []).map(text).filter(Boolean);

const formatDateShort = (iso) =>
  new Date(iso).toLocaleDateString(undefined, {day: 'numeric', month: 'short'});

const formatPosition = (position) =>
  `${Math.abs(position.latitude).toFixed(2)}° ${position.latitude >= 0 ? 'N' : 'S'} `
  + `${Math.abs(position.longitude).toFixed(2)}° ${position.longitude >= 0 ? 'E' : 'W'}`;

const progressFor = (start, end) => {
  const now = Date.now();
  if (now <= start.getTime()) return 0;
  if (now >= end.getTime()) return 100;
  return ((now - start.getTime()) / (end.getTime() - start.getTime())) * 100;
};

const eyebrow = (text) =>
  `<div style="${css({
    fontFamily: SANS, fontSize: '11px', fontWeight: 700, letterSpacing: '1.2px',
    textTransform: 'uppercase', color: MUTED,
  })}">${escapeHtml(text)}</div>`;

const section = (title, innerHtml, extraHtml = '') => `
  <div style="${css({padding: '18px 28px 20px', borderTop: `1px solid ${HAIRLINE}`})}">
    <div style="${css({display: 'flex', alignItems: 'baseline', gap: '6px'})}">
      ${eyebrow(title)}
      ${extraHtml}
    </div>
    <div style="${css({marginTop: '12px'})}">${innerHtml}</div>
  </div>`;

const emptyNote = (text) =>
  `<div style="${css({fontFamily: SANS, fontSize: '13px', color: MUTED})}">${escapeHtml(text)}</div>`;

const voyageCard = (voyage) => {
  const progressPct = progressFor(new Date(voyage.departureDate), new Date(voyage.arrivalDate));
  const isComplete = voyage.status === 'Voyage Completed' || progressPct >= 100;
  const color = isComplete ? VOYAGE_COMPLETE_COLOR : VOYAGE_UNDERWAY_COLOR;

  return `
    <div style="${css({border: `1px solid ${HAIRLINE}`, borderRadius: '6px', padding: '14px 16px 12px', marginBottom: '10px'})}">
      <div style="${css({display: 'flex', justifyContent: 'space-between', fontFamily: SANS, fontSize: '14px', fontWeight: 700, color: INK})}">
        <span>${escapeHtml(voyage.departureLocation)}</span>
        <span>${escapeHtml(voyage.arrivalLocation)}</span>
      </div>
      <div style="${css({display: 'flex', margin: '9px 0 7px', height: '4px', borderRadius: '2px', overflow: 'hidden'})}">
        <div style="${css({width: `${progressPct}%`, backgroundColor: color})}"></div>
        <div style="${css({width: `${100 - progressPct}%`, backgroundColor: TRACK_BG})}"></div>
      </div>
      <div style="${css({display: 'flex', justifyContent: 'space-between', fontFamily: SANS, fontSize: '12px', color: MUTED})}">
        <span>Departed ${formatDateShort(voyage.departureDate)}</span>
        <span>${isComplete ? 'Arrived' : 'ETA'} ${formatDateShort(voyage.arrivalDate)}</span>
      </div>
    </div>`;
};

const statBox = (label, valueHtml, sub) => `
  <div style="${css({flex: '1 1 0%', border: `1px solid ${HAIRLINE}`, borderRadius: '6px', padding: '13px 16px'})}">
    <div style="${css({fontFamily: SANS, fontSize: '10px', fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase', color: MUTED, marginBottom: '6px'})}">
      ${escapeHtml(label)}
    </div>
    <div style="${css({fontFamily: SANS, fontSize: '17px', fontWeight: 700, color: INK})}">
      ${valueHtml}${sub ? ` <span style="${css({fontSize: '13px', fontWeight: 400, color: MUTED})}">${escapeHtml(sub)}</span>` : ''}
    </div>
  </div>`;

const subheader = (text) =>
  `<div style="${css({
    padding: '11px 16px 9px', backgroundColor: ZEBRA_BG, borderBottom: `1px solid ${HAIRLINE}`,
    fontFamily: SANS, fontSize: '10px', fontWeight: 700, letterSpacing: '0.9px', textTransform: 'uppercase', color: MUTED,
  })}">${escapeHtml(text)}</div>`;

const labelValueRow = ({label, value, borderless}) => `
  <div style="${css({
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 16px',
    borderBottom: borderless ? 'none' : `1px solid ${ROW_BORDER}`,
  })}">
    <span style="${css({fontFamily: SANS, fontSize: '14px', color: INK})}">${escapeHtml(label)}</span>
    <span style="${css({fontFamily: SANS, fontSize: '14px', fontWeight: 700, color: INK})}">${value}</span>
  </div>`;

// Rendered as a <table> (not the source component's CSS grid) since grid support
// in email clients is unreliable.
// 'Start' column commented out — causing overflow issues on mobile devices.
const resourceHeaderRow = () => `
  <tr style="background-color:${ZEBRA_BG};border-bottom:1px solid ${HAIRLINE};">
    ${['Tank', /* 'Start', */ 'Received', 'Used', 'Remaining'].map((label, i) => `
      <th style="${css({
        padding: i === 0 ? '9px 14px' : '9px 8px', textAlign: i === 0 ? 'left' : 'right', boxSizing: 'border-box',
        fontFamily: SANS, fontSize: '10px', fontWeight: 700, letterSpacing: '0.9px', textTransform: 'uppercase', color: MUTED,
      })}">${label}</th>`).join('')}
  </tr>`;

const resourceRow = ({label, start, received, consumed, left, borderless}) => `
  <tr style="${borderless ? '' : `border-bottom:1px solid ${ROW_BORDER};`}">
    <td style="${css({padding: '11px 14px', boxSizing: 'border-box', fontFamily: SANS, fontSize: '14px', color: INK, overflowWrap: 'break-word'})}">${escapeHtml(label)}</td>
    <!-- <td style="${css({padding: '11px 8px', textAlign: 'right', fontFamily: MONO, fontSize: '12.5px', color: MUTED})}">${start}</td> -->
    <td style="${css({padding: '11px 8px', textAlign: 'right', boxSizing: 'border-box', fontFamily: MONO, fontSize: '12.5px', color: MUTED, overflowWrap: 'break-word'})}">${received}</td>
    <td style="${css({padding: '11px 8px', textAlign: 'right', boxSizing: 'border-box', fontFamily: MONO, fontSize: '12.5px', color: MUTED, overflowWrap: 'break-word'})}">${consumed}</td>
    <td style="${css({padding: '11px 14px', textAlign: 'right', boxSizing: 'border-box', fontFamily: MONO, fontSize: '12.5px', fontWeight: 600, color: INK, overflowWrap: 'break-word'})}">${left}</td>
  </tr>`;

const remaining = (start, received, consumed) => {
  if (text(start) === '' || Number.isNaN(Number(start))) return emptyDash();
  return String(Number(start) + (Number(received) || 0) - (Number(consumed) || 0));
};

const getSprString = (reportData, vesselName) => {
  const report = obj(reportData);
  const {reportDate} = report;
  const originalOnboard = rows(report.originalOnboard);
  const onboardRows = rows(obj(report.crewSafety).onboardRows);
  const movementRows = rows(obj(report.crewSafety).movementRows);
  const certsAuditsRows = rows(obj(report.general).certsAuditsRows);
  const logbookRows = rows(obj(report.general).logbookRows);
  const miscStatusRows = rows(obj(report.general).miscStatusRows);
  const currentVoyages = rows(obj(report.voyage).currentVoyages);
  const currentPosition = obj(report.voyage).currentPosition ?? null;
  const enginesState = obj(obj(report.machinery).enginesState);
  const generatorsState = obj(obj(report.machinery).generatorsState);
  const windWavesState = obj(obj(report.environmentResources).windWavesState);
  const resourcesState = obj(obj(report.environmentResources).resourcesState);
  const generatorNames = obj(obj(report.siteConfig).generatorNames);
  const thrusterMode = Boolean(obj(report.siteConfig).thrusterMode);

  const recipients = cleanRecipients(report.notificationList);

  const mastheadDate = new Date(`${reportDate}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const signedOnNames = new Set(
    movementRows.filter((m) => m.Typeof === 'sign on').map((m) => text(m.Name).toLowerCase())
  );
  const activeOnboard = onboardRows.filter((row) => text(row.Name));
  const signedOff = movementRows.filter((m) => m.Typeof === 'sign off' && text(m.Name));

  const allGenerators = [
    [generatorNames.GeneratorOne, generatorsState.GeneratorOne],
    [generatorNames.GeneratorTwo, generatorsState.GeneratorTwo],
    [generatorNames.GeneratorThree, generatorsState.GeneratorThree],
    [generatorNames.GeneratorFour, generatorsState.GeneratorFour],
  ];
  const namedGenerators = allGenerators.filter(([name]) => text(name));

  const statusGroups = [];
  miscStatusRows.filter((row) => text(row.description)).forEach((row) => {
    const key = text(row.type) || 'General';
    const existing = statusGroups.find(([type]) => type === key);
    if (existing) existing[1].push(row.description);
    else statusGroups.push([key, [row.description]]);
  });

  const certRows = certsAuditsRows.filter((row) => text(row.Title));
  const logRows = logbookRows.filter((row) => text(row.Item));

  const voyageSection = currentVoyages.length > 0
    ? section('Voyage', `
        <div>
          ${currentVoyages.map(voyageCard).join('')}
        </div>`)
    : '';

  const resourceRows = [
    resourceRow({
      label: 'Fuel',
      start: orDash(resourcesState.FuelStart), received: orDash(resourcesState.FuelReceived), consumed: orDash(resourcesState.FuelConsumed),
      left: remaining(resourcesState.FuelStart, resourcesState.FuelReceived, resourcesState.FuelConsumed),
    }),
    resourceRow({
      label: 'Lube Oil',
      start: orDash(resourcesState.LubeOilStart), received: orDash(resourcesState.LubeOilReceived), consumed: orDash(resourcesState.LubeOilConsumed),
      left: remaining(resourcesState.LubeOilStart, resourcesState.LubeOilReceived, resourcesState.LubeOilConsumed),
    }),
    resourceRow({
      label: 'Hydraulic',
      start: orDash(resourcesState.HydraulicStart), received: orDash(resourcesState.HydraulicReceived), consumed: orDash(resourcesState.HydraulicConsumed),
      left: remaining(resourcesState.HydraulicStart, resourcesState.HydraulicReceived, resourcesState.HydraulicConsumed),
    }),
    resourceRow({
      label: 'Water', borderless: true,
      start: orDash(resourcesState.WaterStart), received: orDash(resourcesState.WaterReceived), consumed: orDash(resourcesState.WaterConsumed),
      left: remaining(resourcesState.WaterStart, resourcesState.WaterReceived, resourcesState.WaterConsumed),
    }),
  ].join('');

  const machineryRows = [
    labelValueRow({label: 'Port', value: orDash(enginesState.PortPropulsion)}),
    labelValueRow({label: 'Starboard', value: orDash(enginesState.StarboardPropulsion), borderless: !thrusterMode}),
  ];
  if (thrusterMode) {
    machineryRows.push(
      labelValueRow({label: 'TT', value: orDash(enginesState.TT)}),
      labelValueRow({label: 'RTT', value: orDash(enginesState.RTT)}),
      labelValueRow({label: 'DP Mode', value: orDash(enginesState.DPMode), borderless: true}),
    );
  }
  const generatorRows = namedGenerators.map(([name, value]) =>
    labelValueRow({label: name, value: orDash(value)}));
  generatorRows.push(
    labelValueRow({label: 'Auxiliary', value: orDash(generatorsState.AuxiliaryGenerator), borderless: true})
  );

  const statusReportsHtml = statusGroups.length === 0
    ? emptyNote('No status reports yet.')
    : `<div>
        ${statusGroups.map(([type, descriptions]) => `
          <div style="${css({borderLeft: `3px solid ${/hse|safety/i.test(type) ? GREEN : ACCENT_BLUE}`, padding: '1px 0 2px 14px', marginBottom: '16px'})}">
            <div style="${css({fontFamily: SANS, fontSize: '13px', fontWeight: 700, color: INK, marginBottom: '8px'})}">${escapeHtml(type)}</div>
            ${descriptions.map((description) => `
              <div style="${css({fontFamily: SANS, fontSize: '14px', color: '#303843', lineHeight: '20px', marginBottom: '5px'})}">
                ${escapeHtml(description)}
              </div>`).join('')}
          </div>`).join('')}
      </div>`;

  const logbookHtml = logRows.length === 0
    ? emptyNote('Nothing logged yet.')
    : `<div style="${css({border: `1px solid ${HAIRLINE}`, borderRadius: '6px', overflow: 'hidden'})}">
        ${logRows.map((row, index) => `
          <div style="${css({
            display: 'flex', gap: '12px', padding: '11px 16px',
            borderBottom: index === logRows.length - 1 ? 'none' : `1px solid ${ROW_BORDER}`,
          })}">
            <span style="${css({fontFamily: MONO, fontSize: '12.5px', color: MUTED, flexShrink: 0, minWidth: '48px'})}">${orDash(row.Time)}</span>
            <span style="${css({fontFamily: SANS, fontSize: '14px', color: INK})}">${escapeHtml(row.Item)}</span>
          </div>`).join('')}
      </div>`;

  const certsHtml = certRows.length === 0
    ? emptyNote('Nothing to report.')
    : `<div style="${css({border: `1px solid ${HAIRLINE}`, borderRadius: '6px', overflow: 'hidden'})}">
        ${certRows.map((row, index) => `
          <div style="${css({
            padding: '12px 16px',
            borderBottom: index === certRows.length - 1 ? 'none' : `1px solid ${ROW_BORDER}`,
          })}">
            <div style="${css({fontFamily: SANS, fontSize: '14px', color: INK, lineHeight: '19px'})}">${escapeHtml(row.Title)}</div>
            <div style="${css({fontFamily: SANS, fontSize: '12px', color: MUTED, paddingTop: '3px'})}">${orDash(row.Typeof)}</div>
          </div>`).join('')}
      </div>`;

  const crewHtml = (activeOnboard.length === 0 && signedOff.length === 0)
    ? emptyNote('No crew onboard yet.')
    : `<div>
        ${activeOnboard.map((row) => {
          const signedOn = signedOnNames.has(text(row.Name).toLowerCase());
          return `
            <div style="${css({
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0',
              borderBottom: `1px solid ${ROW_BORDER}`,
            })}">
              <span style="${css({fontFamily: SANS, fontSize: '14px', color: INK})}">${escapeHtml(row.Name)}</span>
              <div style="${css({display: 'flex', alignItems: 'center', gap: '10px'})}">
                ${signedOn ? `<span style="${css({fontFamily: SANS, fontSize: '12px', fontWeight: 700, color: GREEN})}">Sign On</span>` : ''}
                <span style="${css({fontFamily: SANS, fontSize: '13px', color: MUTED})}">${escapeHtml(row.Role)}</span>
              </div>
            </div>`;
        }).join('')}
        ${signedOff.map((m, index) => {
          const role = originalOnboard.find(
            (o) => text(o.Name).toLowerCase() === text(m.Name).toLowerCase()
          )?.Role ?? '';
          return `
            <div style="${css({
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0',
              borderBottom: index === signedOff.length - 1 ? 'none' : `1px solid ${ROW_BORDER}`,
            })}">
              <span style="${css({fontFamily: SANS, fontSize: '14px', textDecoration: 'line-through', color: STRIKE_MUTED})}">${escapeHtml(m.Name)}</span>
              <div style="${css({display: 'flex', alignItems: 'center', gap: '10px'})}">
                <span style="${css({fontFamily: SANS, fontSize: '12px', fontWeight: 700, color: MUTED_LIGHT})}">Sign Off</span>
                <span style="${css({fontFamily: SANS, fontSize: '13px', textDecoration: 'line-through', color: STRIKE_MUTED})}">${escapeHtml(role)}</span>
              </div>
            </div>`;
        }).join('')}
      </div>`;

  return `
    <div>
      <div style="${css({maxWidth: '620px', margin: '0 auto', padding: '24px 12px 40px'})}">
        <div style="${css({border: `1px solid ${BORDER}`, borderRadius: '8px', overflow: 'hidden'})}">

          <div style="${css({backgroundColor: MASTHEAD_BG, padding: '26px 28px 24px'})}">
            <div style="${css({fontFamily: SANS, fontSize: '11px', fontWeight: 700, letterSpacing: '1.4px', textTransform: 'uppercase', color: MASTHEAD_MUTED, paddingBottom: '8px'})}">
              Ship Position Report
            </div>
            <div style="${css({fontFamily: SANS, fontSize: '28px', fontWeight: 800, letterSpacing: '-0.02em', color: '#fff', paddingBottom: '6px'})}">
              ${vesselName ? escapeHtml(vesselName) : emptyDash(MASTHEAD_SUB)}
            </div>
            <div style="${css({fontFamily: SANS, fontSize: '14px', color: MASTHEAD_SUB})}">
              ${mastheadDate}
            </div>
          </div>

          <div style="${css({backgroundColor: ACCENT_BLUE, padding: '14px 28px 16px'})}">
            <div style="${css({fontFamily: SANS, fontSize: '10px', fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase', color: ACCENT_BLUE_LIGHT, paddingBottom: '5px'})}">
              Position
            </div>
            <div style="${css({fontFamily: SANS, fontSize: '15px', color: '#fff'})}">
              ${currentPosition ? formatPosition(currentPosition) : emptyDash(ACCENT_BLUE_LIGHT)}
            </div>
          </div>

          ${voyageSection}

          ${section('Wind & sea', `
            <div style="${css({display: 'flex', gap: '12px'})}">
              ${statBox('Wind', windWavesState.WindSpeed ? `${escapeHtml(windWavesState.WindSpeed)} kts` : emptyDash(), windWavesState.WindDirection ? `from ${windWavesState.WindDirection}` : undefined)}
              ${statBox('Waves', windWavesState.WavesHeight ? `${escapeHtml(windWavesState.WavesHeight)} m` : emptyDash(), windWavesState.WavesDirection ? `from ${windWavesState.WavesDirection}` : undefined)}
            </div>`)}

          ${section('Resources', `
            <table style="${css({width: '100%', tableLayout: 'fixed', boxSizing: 'border-box', borderCollapse: 'collapse', border: `1px solid ${HAIRLINE}`, borderRadius: '6px'})}">
              ${resourceHeaderRow()}
              ${resourceRows}
            </table>`)}

          ${section('Machinery', `
            <div style="${css({border: `1px solid ${HAIRLINE}`, borderRadius: '6px', overflow: 'hidden'})}">
              ${subheader('Engines')}
              ${machineryRows.join('')}
              ${subheader('Generators')}
              ${generatorRows.join('')}
            </div>`)}

          ${section('Status reports', statusReportsHtml)}

          ${section('Critical path logbook', logbookHtml)}

          ${section('Certs, audits, etc', certsHtml)}

          ${section('Crew onboard', crewHtml, `<span style="${css({fontFamily: SANS, fontSize: '11px', color: MUTED})}">(${activeOnboard.length})</span>`)}
        </div>

        <div style="${css({padding: '20px 12px 0', fontFamily: SANS, fontSize: '12px', color: MUTED, lineHeight: '18px'})}">
          <div style="${css({paddingBottom: '6px'})}">
            <span style="${css({fontWeight: 700, color: MUTED})}">Distribution: </span>
            ${recipients.length ? escapeHtml(recipients.join(', ')) : 'No recipients added yet'}
          </div>
          <div>Generated from the vessel daily report for ${escapeHtml(reportDate)}. Reply all to this message to query any line item.</div>
        </div>
      </div>
    </div>`;
};

module.exports = {getSprString, cleanRecipients};

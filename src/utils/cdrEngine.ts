import {
  CDRRecord,
  RawCDRRow,
  InactivityAlert,
  ExtensionInactivity,
  OutboundExtensionStats,
  InboundExtensionStats,
  HourlyDistribution,
  FilterOptions,
  ColumnMapping
} from '../types';

const MONTHS_SPANISH_ENGLISH: Record<string, number> = {
  // English
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
  // Spanish
  ene: 0, enero: 0,
  febr: 1, febrero: 1,
  marz: 2, marzo: 2,
  abr: 3, abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  ago: 7, agosto: 7,
  set: 8, setiembre: 8, septiembre: 8,
  octubre: 9,
  novi: 10, noviembre: 10,
  dic: 11, dici: 11, diciembre: 11
};

/**
 * Parses various date-time formats safely, handling both single combined fields
 * and separate Date + Time values, with support for English and Spanish month names,
 * Excel serial numbers, Unix epochs, compact date strings, subseconds, and recording file names.
 */
export function parseDateTime(dateVal: any, timeVal?: any): Date | null {
  if (dateVal === null || dateVal === undefined) {
    if (timeVal === null || timeVal === undefined) return null;
    dateVal = '';
  }

  // If already a Date object
  if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
    if (timeVal && typeof timeVal === 'string') {
      const tMatch = timeVal.trim().match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
      if (tMatch) {
        const d = new Date(dateVal.getTime());
        d.setHours(parseInt(tMatch[1], 10), parseInt(tMatch[2], 10), tMatch[3] ? parseInt(tMatch[3], 10) : 0);
        return d;
      }
    }
    return dateVal;
  }

  // Clean raw strings and strip quotes/BOM
  const rawDateStr = String(dateVal || '').trim().replace(/^["'\uFEFF]|["']$/g, '');
  const rawTimeStr = String(timeVal || '').trim().replace(/^["'\uFEFF]|["']$/g, '');

  // 1. Check if dateVal is a Unix epoch in seconds (e.g. 1787069164) or ms
  if (/^\d{9,13}(\.\d+)?$/.test(rawDateStr)) {
    const epochNum = parseFloat(rawDateStr);
    const ms = epochNum < 10000000000 ? epochNum * 1000 : epochNum;
    const epochDate = new Date(ms);
    if (!isNaN(epochDate.getTime()) && epochDate.getFullYear() >= 2000 && epochDate.getFullYear() <= 2100) {
      return epochDate;
    }
  }

  // 2. Check if dateVal is an Excel serial date (number or numeric string like "45512" or "45512.416")
  let numVal: number | null = null;
  if (typeof dateVal === 'number') {
    numVal = dateVal;
  } else if (/^\d{4,6}(\.\d+)?$/.test(rawDateStr)) {
    numVal = parseFloat(rawDateStr);
  }

  if (numVal !== null && !isNaN(numVal) && numVal >= 35000 && numVal < 80000) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    let ms = numVal * 86400 * 1000;
    if (typeof timeVal === 'number') {
      ms += timeVal * 86400 * 1000;
    } else if (typeof timeVal === 'string' && /^\d+(\.\d+)?$/.test(rawTimeStr)) {
      ms += parseFloat(rawTimeStr) * 86400 * 1000;
    }
    const d = new Date(excelEpoch.getTime() + ms);
    if (!isNaN(d.getTime())) return d;
  }

  let combined = rawTimeStr ? `${rawDateStr} ${rawTimeStr}` : rawDateStr;
  combined = combined.trim();
  if (!combined) return null;

  // Extract time parts (including optional subseconds like :04.135 or :04,135)
  let hours = 0;
  let minutes = 0;
  let seconds = 0;

  const timeMatch = combined.match(/(?:^|\s|T)(\d{1,2}):(\d{1,2})(?::(\d{1,2})(?:[.,]\d+)?)?(?:\s*(am|pm))?/i);
  if (timeMatch) {
    hours = parseInt(timeMatch[1], 10);
    minutes = parseInt(timeMatch[2], 10);
    seconds = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
    const ampm = timeMatch[4] ? timeMatch[4].toLowerCase() : null;
    if (ampm === 'pm' && hours < 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;
  }

  // Clean dateOnlyStr by stripping time and subseconds
  let dateOnlyStr = combined
    .replace(/(?:T|\s+)\d{1,2}:\d{1,2}(?::\d{1,2}(?:[.,]\d+)?)?(?:\s*(?:am|pm))?/i, '')
    .replace(/["']/g, '')
    .trim();

  const parseMonthName = (mRaw: string): number => {
    if (!mRaw) return -1;
    const mStr = mRaw.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z]/g, "");

    if (mStr.length < 2) return -1;

    for (const [k, v] of Object.entries(MONTHS_SPANISH_ENGLISH)) {
      if (mStr === k || mStr.startsWith(k) || k.startsWith(mStr)) {
        if (Math.min(mStr.length, k.length) >= 2) {
          return v;
        }
      }
    }
    return -1;
  };

  // 1. Text Month Pattern (e.g. "18 Aug 2026", "18-Ago-2026", "18 de Agosto de 2026", "18/Aug/2026")
  const textMonthMatch = dateOnlyStr.match(/^(\d{1,2})[\s\-/.de]+([a-zA-ZáéíóúÁÉÍÓÚ\.]+[\s\-/.de]*[a-zA-ZáéíóúÁÉÍÓÚ]{2,15})[\s\-/.de]+(\d{2,4})/i);
  if (textMonthMatch) {
    const day = parseInt(textMonthMatch[1], 10);
    const month = parseMonthName(textMonthMatch[2]);
    let year = parseInt(textMonthMatch[3], 10);
    if (year < 100) year += 2000;
    if (month !== -1 && day >= 1 && day <= 31) {
      const parsed = new Date(year, month, day, hours, minutes, seconds);
      if (!isNaN(parsed.getTime())) return parsed;
    }
  }

  // 2. Month Text First (e.g. "Aug 18, 2026" or "Agosto 18 2026")
  const monthTextFirstMatch = dateOnlyStr.match(/^([a-zA-ZáéíóúÁÉÍÓÚ\.]+[\s\-/.de]*[a-zA-ZáéíóúÁÉÍÓÚ]{2,15})[\s\-/.de]+(\d{1,2})(?:st|nd|rd|th)?,?[\s\-/.de]+(\d{2,4})/i);
  if (monthTextFirstMatch) {
    const month = parseMonthName(monthTextFirstMatch[1]);
    const day = parseInt(monthTextFirstMatch[2], 10);
    let year = parseInt(monthTextFirstMatch[3], 10);
    if (year < 100) year += 2000;
    if (month !== -1 && day >= 1 && day <= 31) {
      const parsed = new Date(year, month, day, hours, minutes, seconds);
      if (!isNaN(parsed.getTime())) return parsed;
    }
  }

  // 3. Numeric Date Pattern with separators /, -, ., or space (e.g., 18/08/2026, 2026-08-18, 18.08.2026)
  const numericMatch = dateOnlyStr.match(/^(\d{1,4})([/.\-\s])(\d{1,2})\2(\d{1,4})/);
  if (numericMatch) {
    const p1 = parseInt(numericMatch[1], 10);
    const p2 = parseInt(numericMatch[3], 10);
    const p3 = parseInt(numericMatch[4], 10);

    let year = 0, month = 0, day = 0;
    if (p1 > 31) {
      // YYYY-MM-DD
      year = p1 < 100 ? p1 + 2000 : p1;
      month = p2 - 1;
      day = p3;
    } else if (p3 > 31 || p3 >= 100) {
      // DD/MM/YYYY or MM/DD/YYYY
      year = p3 < 100 ? p3 + 2000 : p3;
      if (p1 > 12) {
        day = p1;
        month = p2 - 1;
      } else if (p2 > 12) {
        month = p1 - 1;
        day = p2;
      } else {
        // Default to DD/MM/YYYY in Latin America / Spain
        day = p1;
        month = p2 - 1;
      }
    } else {
      if (p1 > 31) {
        year = p1 < 100 ? p1 + 2000 : p1;
        month = p2 - 1;
        day = p3;
      } else {
        year = p3 < 100 ? p3 + 2000 : p3 + 2000;
        day = p1;
        month = p2 - 1;
      }
    }

    if (year >= 2000 && year <= 2100 && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      const parsed = new Date(year, month, day, hours, minutes, seconds);
      if (!isNaN(parsed.getTime())) return parsed;
    }
  }

  // 4. Compact 8-digit date format: YYYYMMDD (e.g. "20260818")
  const compactYMDMatch = dateOnlyStr.match(/^(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/);
  if (compactYMDMatch) {
    const year = parseInt(compactYMDMatch[1], 10);
    const month = parseInt(compactYMDMatch[2], 10) - 1;
    const day = parseInt(compactYMDMatch[3], 10);
    const parsed = new Date(year, month, day, hours, minutes, seconds);
    if (!isNaN(parsed.getTime())) return parsed;
  }

  // 5. Fallback: Parse filename containing timestamp (e.g. "out-987589936-5005-20260818-100604-1787069164.135918.wav")
  const fileTimestampMatch = combined.match(/(20\d{2})(\d{2})(\d{2})[-_](\d{2})(\d{2})(\d{2})/);
  if (fileTimestampMatch) {
    const y = parseInt(fileTimestampMatch[1], 10);
    const m = parseInt(fileTimestampMatch[2], 10) - 1;
    const d = parseInt(fileTimestampMatch[3], 10);
    const h = parseInt(fileTimestampMatch[4], 10);
    const min = parseInt(fileTimestampMatch[5], 10);
    const s = parseInt(fileTimestampMatch[6], 10);
    if (m >= 0 && m <= 11 && d >= 1 && d <= 31) {
      const parsed = new Date(y, m, d, h, min, s);
      if (!isNaN(parsed.getTime())) return parsed;
    }
  }

  // 6. ISO Date fallback
  if (dateOnlyStr.includes('T') || dateOnlyStr.includes('-')) {
    const isoDate = new Date(combined);
    if (!isNaN(isoDate.getTime()) && isoDate.getFullYear() >= 2000 && isoDate.getFullYear() <= 2100) {
      return isoDate;
    }
  }

  return null;
}

/**
 * Parses duration in seconds from number, seconds string, HH:MM:SS, MM:SS, or text units
 */
export function parseDurationSeconds(val: any): number {
  if (typeof val === 'number') return Math.max(0, Math.round(val));
  if (!val) return 0;
  
  const str = String(val).trim().replace(/^["']|["']$/g, '').replace(',', '.');
  
  // If time format HH:MM:SS or MM:SS
  if (str.includes(':')) {
    const parts = str.split(':').map(p => parseFloat(p));
    if (parts.length === 3 && !parts.some(isNaN)) {
      return Math.round(parts[0] * 3600 + parts[1] * 60 + parts[2]);
    } else if (parts.length === 2 && !parts.some(isNaN)) {
      return Math.round(parts[0] * 60 + parts[1]);
    }
  }

  // If text units like "1m 40s" or "2 min 15 seg"
  const minMatch = str.match(/(\d+)\s*(?:m|min)/i);
  const secMatch = str.match(/(\d+)\s*(?:s|seg|sec)/i);
  if (minMatch || secMatch) {
    const m = minMatch ? parseInt(minMatch[1], 10) : 0;
    const s = secMatch ? parseInt(secMatch[1], 10) : 0;
    return Math.max(0, m * 60 + s);
  }

  // If numeric string like "120" or "18.5"
  const numMatch = str.match(/^(\d+(?:\.\d+)?)/);
  if (numMatch) {
    return Math.max(0, Math.round(parseFloat(numMatch[1])));
  }

  return 0;
}

/**
 * Normalizes calltype with fallback support for file names and direction codes
 */
export function normalizeCallType(val: any, fallbackHint?: string): 'Outgoing' | 'Incoming' | 'Internal' {
  const str = String(val || fallbackHint || '').trim().toLowerCase();
  
  if (
    str.includes('out') || 
    str.includes('sal') || 
    str.includes('emi') || 
    str.includes('marc') || 
    str === 'o' || 
    str === '1'
  ) {
    return 'Outgoing';
  }
  if (
    str.includes('in') || 
    str.includes('ent') || 
    str.includes('rec') || 
    str.includes('aten') || 
    str === 'i' || 
    str === '2'
  ) {
    return 'Incoming';
  }
  if (str.includes('int') || str.includes('loc') || str.includes('trans') || str === '3') {
    return 'Internal';
  }
  return 'Outgoing';
}

/**
 * Formats seconds into MM:SS or HH:MM:SS
 */
export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const s = Math.round(seconds);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;

  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Formats time (e.g. 10:42)
 */
export function formatTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Converts raw uploaded rows into normalized CDRRecords without arbitrary limits.
 * All rows from CSV or Excel datasets (e.g., 2,665, 5,000, 100,000+) are completely
 * processed, timestamped, indexed, and made available across all date filters.
 */
export function processRawCDRRows(
  rows: RawCDRRow[],
  mapping?: Partial<ColumnMapping>
): CDRRecord[] {
  if (!rows || rows.length === 0) return [];

  const cleanStr = (s: string) => {
    return s.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, '');
  };

  // Helper to extract a value from a row with key resilience (handles spaces, casing, accents)
  const getRowVal = (row: RawCDRRow, primaryKey?: string, fallbackCandidates?: string[]): any => {
    if (!row) return undefined;
    if (primaryKey && row[primaryKey] !== undefined && row[primaryKey] !== null && String(row[primaryKey]).trim() !== '') {
      return row[primaryKey];
    }
    const rowKeys = Object.keys(row);
    if (primaryKey) {
      const cleanPrimary = cleanStr(primaryKey);
      const matched = rowKeys.find(k => cleanStr(k) === cleanPrimary);
      if (matched && row[matched] !== undefined && String(row[matched]).trim() !== '') {
        return row[matched];
      }
    }
    if (fallbackCandidates && fallbackCandidates.length > 0) {
      for (const cand of fallbackCandidates) {
        const cleanCand = cleanStr(cand);
        const matched = rowKeys.find(k => {
          const ck = cleanStr(k);
          return ck === cleanCand || ck.includes(cleanCand);
        });
        if (matched && row[matched] !== undefined && String(row[matched]).trim() !== '') {
          return row[matched];
        }
      }
    }
    return undefined;
  };

  const records: CDRRecord[] = [];

  rows.forEach((row, idx) => {
    if (!row) return;

    // 1. Resolve date and time values
    const rawDate = getRowVal(row, mapping?.dateCol, ['fecha', 'date', 'day', 'dia', 'calldate', 'fechainicio']);
    const rawTime = getRowVal(row, mapping?.timeCol, ['hora', 'time', 'hour', 'horainicio', 'horallamada']);
    const rawDateTime = getRowVal(row, mapping?.dateTimeCol, ['datetime', 'timestamp', 'fechahora', 'fechayhora', 'date_time', 'calldate', 'start']);
    const rawFile = getRowVal(row, undefined, ['file', 'audio', 'recording', 'grabacion', 'filename']);

    let parsedDate: Date | null = null;

    // Check separate date + time
    if (rawDate !== undefined && rawTime !== undefined) {
      parsedDate = parseDateTime(rawDate, rawTime);
    } else if (rawDateTime !== undefined) {
      parsedDate = parseDateTime(rawDateTime, rawTime);
    } else if (rawDate !== undefined) {
      parsedDate = parseDateTime(rawDate);
    }

    // Fallback: check file name or any column containing timestamp
    if (!parsedDate) {
      if (rawFile) {
        parsedDate = parseDateTime(rawFile);
      }
      if (!parsedDate) {
        const allKeys = Object.keys(row);
        for (const k of allKeys) {
          if (row[k]) {
            parsedDate = parseDateTime(row[k]);
            if (parsedDate) break;
          }
        }
      }
    }

    if (!parsedDate || isNaN(parsedDate.getTime())) return;

    // 2. Resolve duration
    const rawDuration = getRowVal(row, mapping?.durationCol, ['duracion', 'duration', 'duracionseg', 'talktime', 'tiempo', 'segundos', 'billsec', 'duracion_seg']);
    const duration = parseDurationSeconds(rawDuration);

    // 3. Resolve call type
    const rawCallType = getRowVal(row, mapping?.callTypeCol, ['tipo', 'calltype', 'tipollamada', 'direction', 'sentido', 'tipo_llamada', 'type', 'disposition']);
    const callType = normalizeCallType(rawCallType, rawFile ? String(rawFile) : undefined);

    // 4. Resolve from & to
    const rawFrom = getRowVal(row, mapping?.fromCol, ['origen', 'from', 'caller', 'src', 'extension', 'agent', 'de', 'source', 'calling_party', 'ext']);
    const rawTo = getRowVal(row, mapping?.toCol, ['destino', 'to', 'callee', 'dst', 'receptor', 'para', 'target', 'destination', 'called_party']);

    const from = String(rawFrom !== undefined && rawFrom !== null ? rawFrom : '').trim().replace(/^["']|["']$/g, '');
    const to = String(rawTo !== undefined && rawTo !== null ? rawTo : '').trim().replace(/^["']|["']$/g, '');

    // Agent extension resolution
    let agentExtension = '';
    const isFromShortExt = from.length >= 2 && from.length <= 6 && /^\d+$/.test(from);
    const isToShortExt = to.length >= 2 && to.length <= 6 && /^\d+$/.test(to);

    if (callType === 'Outgoing') {
      if (isFromShortExt) {
        agentExtension = from;
      } else if (isToShortExt) {
        agentExtension = to;
      } else {
        agentExtension = from || to || 'Ext-101';
      }
    } else {
      if (isToShortExt) {
        agentExtension = to;
      } else if (isFromShortExt) {
        agentExtension = from;
      } else {
        agentExtension = to || from || 'Ext-101';
      }
    }

    records.push({
      id: `cdr-${idx}-${parsedDate.getTime()}`,
      dateTime: parsedDate,
      dateTimeString: parsedDate.toISOString(),
      durationSeconds: duration,
      callType,
      from,
      to,
      agentExtension,
      status: row.status ? String(row.status) : (duration > 0 ? 'ANSWERED' : 'NO ANSWER')
    });
  });

  // Sort all records chronologically
  records.sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());

  return records;
}

/**
 * Filter CDR records based on Shift, Multi-Date / Date, Extension, and Hourly / Lunch exclusions
 */
export function filterCDRRecords(records: CDRRecord[], filters: FilterOptions): CDRRecord[] {
  const hasDateList = filters.selectedDates && filters.selectedDates.length > 0 && !filters.selectedDates.includes('all');
  const singleDate = filters.date && filters.date !== 'all' ? filters.date : null;

  const hasExcludedHours = filters.excludedHours && filters.excludedHours.length > 0;
  const hasSelectedHours = filters.selectedHours && filters.selectedHours.length > 0 && filters.selectedHours.length < 24;

  return records.filter(record => {
    const dateObj = record.dateTime;
    const hour = dateObj.getHours();

    // 1. Shift filter (applied if no explicit custom selected hours are given)
    if (!hasSelectedHours) {
      if (filters.shift === 'morning') {
        if (hour < 8 || hour >= 14) return false;
      } else if (filters.shift === 'afternoon') {
        if (hour < 14 || hour >= 20) return false;
      } else if (filters.shift === 'night') {
        if (hour >= 8 && hour < 20) return false;
      }
    }

    // 2. Custom Hourly Selection / Lunch Exclusion
    if (hasExcludedHours && filters.excludedHours!.includes(hour)) {
      return false;
    }
    if (hasSelectedHours && !filters.selectedHours!.includes(hour)) {
      return false;
    }

    // 3. Multi-Date or Single Date filter
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const recordDateStr = `${year}-${month}-${day}`;

    if (hasDateList) {
      if (!filters.selectedDates!.includes(recordDateStr)) {
        return false;
      }
    } else if (singleDate) {
      if (recordDateStr !== singleDate) {
        return false;
      }
    }

    // 4. Extension filter
    if (filters.extension && filters.extension !== 'all') {
      if (record.agentExtension !== filters.extension && record.from !== filters.extension && record.to !== filters.extension) {
        return false;
      }
    }

    // 5. Excluded Extensions filter
    if (filters.excludedExtensions && filters.excludedExtensions.length > 0) {
      const isExcluded = filters.excludedExtensions.some(ext => 
        record.agentExtension === ext || record.from === ext || record.to === ext
      );
      if (isExcluded) return false;
    }

    return true;
  });
}

/**
 * Calculates Dead Time (Inactivity) and Critical Alerts
 * Rule: Gap = next_start - (prev_start + prev_duration)
 * Ignore gaps > 2 hours (120 minutes = 7200 seconds)
 * Critical alerts: gap > 5 minutes (300 seconds)
 */
export function calculateInactivityAnalysis(records: CDRRecord[]): {
  overallAvgDeadTimeMinutes: number;
  worstExtension: { extension: string; deadTimeMinutes: number };
  totalCallsProcessed: number;
  criticalAlertsCount: number;
  extensionDeadTimes: ExtensionInactivity[];
  top5DeadTimes: ExtensionInactivity[];
  alerts: InactivityAlert[];
  hourlyDistribution: { hour: number; label: string; deadTimeMinutes: number; callsCount: number }[];
} {
  const totalCallsProcessed = records.length;
  if (totalCallsProcessed === 0) {
    return {
      overallAvgDeadTimeMinutes: 0,
      worstExtension: { extension: 'N/A', deadTimeMinutes: 0 },
      totalCallsProcessed: 0,
      criticalAlertsCount: 0,
      extensionDeadTimes: [],
      top5DeadTimes: [],
      alerts: [],
      hourlyDistribution: []
    };
  }

  // Group records by agent extension
  const byExtension = new Map<string, CDRRecord[]>();
  records.forEach(r => {
    const ext = r.agentExtension;
    if (!byExtension.has(ext)) {
      byExtension.set(ext, []);
    }
    byExtension.get(ext)!.push(r);
  });

  const alerts: InactivityAlert[] = [];
  const extensionStatsMap = new Map<string, {
    totalDeadSeconds: number;
    pauseCount: number;
    criticalCount: number;
    maxPauseSeconds: number;
  }>();

  // Hourly dead time accumulator: 0 to 23
  const hourlyDeadSeconds = new Array(24).fill(0);
  const hourlyCalls = new Array(24).fill(0);

  records.forEach(r => {
    const h = r.dateTime.getHours();
    hourlyCalls[h]++;
  });

  byExtension.forEach((extRecords, ext) => {
    // Sort chronologically
    extRecords.sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());

    let totalDeadSec = 0;
    let pauseCount = 0;
    let criticalCount = 0;
    let maxPauseSec = 0;

    for (let i = 0; i < extRecords.length - 1; i++) {
      const currentCall = extRecords[i];
      const nextCall = extRecords[i + 1];

      const currentEndMs = currentCall.dateTime.getTime() + (currentCall.durationSeconds * 1000);
      const nextStartMs = nextCall.dateTime.getTime();

      const deadMs = nextStartMs - currentEndMs;
      const deadSec = Math.floor(deadMs / 1000);

      // Ignore negative (overlapping)
      if (deadSec <= 0) continue;

      // Ignore pauses > 2 hours (7200 seconds) - lunch, shift change, or next day
      if (deadSec > 7200) continue;

      totalDeadSec += deadSec;
      pauseCount++;
      if (deadSec > maxPauseSec) maxPauseSec = deadSec;

      // Hourly accumulation based on currentEnd time
      const endHour = new Date(currentEndMs).getHours();
      hourlyDeadSeconds[endHour] += deadSec;

      // Critical alert if > 5 minutes (300 seconds)
      if (deadSec >= 300) {
        criticalCount++;
        const deadMinutes = parseFloat((deadSec / 60).toFixed(1));
        const severity = deadMinutes >= 15 ? 'critical' : (deadMinutes >= 10 ? 'warning' : 'normal');

        alerts.push({
          id: `alert-${ext}-${i}-${currentEndMs}`,
          extension: ext,
          startTime: formatTime(new Date(currentEndMs)),
          endTime: formatTime(nextCall.dateTime),
          durationSeconds: deadSec,
          durationMinutes: deadMinutes,
          prevCallDuration: currentCall.durationSeconds,
          nextCallDuration: nextCall.durationSeconds,
          severity
        });
      }
    }

    extensionStatsMap.set(ext, {
      totalDeadSeconds: totalDeadSec,
      pauseCount,
      criticalCount,
      maxPauseSeconds: maxPauseSec
    });
  });

  // Compile extension list
  const extensionDeadTimes: ExtensionInactivity[] = [];
  let totalAllDeadSeconds = 0;
  let totalAllPauses = 0;

  extensionStatsMap.forEach((stats, ext) => {
    totalAllDeadSeconds += stats.totalDeadSeconds;
    totalAllPauses += stats.pauseCount;
    const avgMinutes = stats.pauseCount > 0 ? (stats.totalDeadSeconds / stats.pauseCount / 60) : 0;

    extensionDeadTimes.push({
      extension: ext,
      totalDeadTimeMinutes: parseFloat((stats.totalDeadSeconds / 60).toFixed(1)),
      avgDeadTimeMinutes: parseFloat(avgMinutes.toFixed(1)),
      pausesCount: stats.pauseCount,
      criticalPausesCount: stats.criticalCount,
      maxPauseMinutes: parseFloat((stats.maxPauseSeconds / 60).toFixed(1))
    });
  });

  // Sort top extension by total dead time
  extensionDeadTimes.sort((a, b) => b.totalDeadTimeMinutes - a.totalDeadTimeMinutes);

  const top5DeadTimes = extensionDeadTimes.slice(0, 5);

  const worstExtension = top5DeadTimes.length > 0
    ? { extension: top5DeadTimes[0].extension, deadTimeMinutes: top5DeadTimes[0].totalDeadTimeMinutes }
    : { extension: 'N/A', deadTimeMinutes: 0 };

  const overallAvgDeadTimeMinutes = totalAllPauses > 0
    ? parseFloat((totalAllDeadSeconds / totalAllPauses / 60).toFixed(1))
    : 0;

  // Sort alerts descending by duration
  alerts.sort((a, b) => b.durationSeconds - a.durationSeconds);

  // Hourly distribution
  const hourlyDistribution = [];
  for (let h = 8; h <= 20; h++) {
    hourlyDistribution.push({
      hour: h,
      label: `${h}h`,
      deadTimeMinutes: parseFloat((hourlyDeadSeconds[h] / 60).toFixed(1)),
      callsCount: hourlyCalls[h]
    });
  }

  return {
    overallAvgDeadTimeMinutes,
    worstExtension,
    totalCallsProcessed,
    criticalAlertsCount: alerts.length,
    extensionDeadTimes,
    top5DeadTimes,
    alerts,
    hourlyDistribution
  };
}

/**
 * Calculates Outbound KPIs
 * Filter: calltype === 'Outgoing'
 * KPIs: Total llamadas salientes, AHT promedio, Contactos Efectivos (> 1 min), % Efectividad
 */
export function calculateOutboundAnalysis(records: CDRRecord[]): {
  totalOutboundCalls: number;
  totalDurationSeconds: number;
  avgHandlingTimeSeconds: number; // AHT
  effectiveContacts: number;     // > 60s
  effectiveRate: number;         // percentage
  extensionStats: OutboundExtensionStats[];
  top5ExtensionsByVolume: OutboundExtensionStats[];
  durationDistribution: { range: string; count: number; percentage: number }[];
  hourlyDistribution: { hour: number; label: string; calls: number; effectiveCalls: number }[];
} {
  const outboundRecords = records.filter(r => r.callType === 'Outgoing');
  const totalOutboundCalls = outboundRecords.length;

  if (totalOutboundCalls === 0) {
    return {
      totalOutboundCalls: 0,
      totalDurationSeconds: 0,
      avgHandlingTimeSeconds: 0,
      effectiveContacts: 0,
      effectiveRate: 0,
      extensionStats: [],
      top5ExtensionsByVolume: [],
      durationDistribution: [
        { range: '< 30s', count: 0, percentage: 0 },
        { range: '30s - 1m', count: 0, percentage: 0 },
        { range: '1m - 3m', count: 0, percentage: 0 },
        { range: '3m - 5m', count: 0, percentage: 0 },
        { range: '> 5m', count: 0, percentage: 0 }
      ],
      hourlyDistribution: []
    };
  }

  let totalDurationSeconds = 0;
  let effectiveContacts = 0;

  const durationBins = {
    under30: 0,
    under60: 0,
    under180: 0,
    under300: 0,
    over300: 0
  };

  const byExtension = new Map<string, {
    totalCalls: number;
    totalDuration: number;
    effectiveCalls: number;
  }>();

  const hourlyCalls = new Array(24).fill(0);
  const hourlyEffective = new Array(24).fill(0);

  outboundRecords.forEach(r => {
    const dur = r.durationSeconds;
    totalDurationSeconds += dur;
    const isEffective = dur > 60;
    if (isEffective) effectiveContacts++;

    // Duration bins
    if (dur < 30) durationBins.under30++;
    else if (dur <= 60) durationBins.under60++;
    else if (dur <= 180) durationBins.under180++;
    else if (dur <= 300) durationBins.under300++;
    else durationBins.over300++;

    // Hourly
    const h = r.dateTime.getHours();
    hourlyCalls[h]++;
    if (isEffective) hourlyEffective[h]++;

    // Extension stats
    const ext = r.from || r.agentExtension;
    if (!byExtension.has(ext)) {
      byExtension.set(ext, { totalCalls: 0, totalDuration: 0, effectiveCalls: 0 });
    }
    const extStat = byExtension.get(ext)!;
    extStat.totalCalls++;
    extStat.totalDuration += dur;
    if (isEffective) extStat.effectiveCalls++;
  });

  const avgHandlingTimeSeconds = Math.round(totalDurationSeconds / totalOutboundCalls);
  const effectiveRate = parseFloat(((effectiveContacts / totalOutboundCalls) * 100).toFixed(1));

  const extensionStats: OutboundExtensionStats[] = [];
  byExtension.forEach((stats, ext) => {
    const avg = stats.totalCalls > 0 ? Math.round(stats.totalDuration / stats.totalCalls) : 0;
    const effRate = stats.totalCalls > 0 ? parseFloat(((stats.effectiveCalls / stats.totalCalls) * 100).toFixed(1)) : 0;
    extensionStats.push({
      extension: ext,
      totalCalls: stats.totalCalls,
      totalDurationSeconds: stats.totalDuration,
      avgDurationSeconds: avg,
      effectiveCalls: stats.effectiveCalls,
      effectiveRate: effRate
    });
  });

  // Sort by total calls descending
  extensionStats.sort((a, b) => b.totalCalls - a.totalCalls);
  const top5ExtensionsByVolume = extensionStats.slice(0, 5);

  const durationDistribution = [
    { range: '< 30s', count: durationBins.under30, percentage: parseFloat(((durationBins.under30 / totalOutboundCalls) * 100).toFixed(1)) },
    { range: '30s - 1m', count: durationBins.under60, percentage: parseFloat(((durationBins.under60 / totalOutboundCalls) * 100).toFixed(1)) },
    { range: '1m - 3m', count: durationBins.under180, percentage: parseFloat(((durationBins.under180 / totalOutboundCalls) * 100).toFixed(1)) },
    { range: '3m - 5m', count: durationBins.under300, percentage: parseFloat(((durationBins.under300 / totalOutboundCalls) * 100).toFixed(1)) },
    { range: '> 5m', count: durationBins.over300, percentage: parseFloat(((durationBins.over300 / totalOutboundCalls) * 100).toFixed(1)) }
  ];

  const hourlyDistribution = [];
  for (let h = 8; h <= 20; h++) {
    hourlyDistribution.push({
      hour: h,
      label: `${h}h`,
      calls: hourlyCalls[h],
      effectiveCalls: hourlyEffective[h]
    });
  }

  return {
    totalOutboundCalls,
    totalDurationSeconds,
    avgHandlingTimeSeconds,
    effectiveContacts,
    effectiveRate,
    extensionStats,
    top5ExtensionsByVolume,
    durationDistribution,
    hourlyDistribution
  };
}

/**
 * Calculates Inbound KPIs
 * Filter: calltype === 'Incoming'
 * KPIs: Total llamadas entrantes, TMO promedio, Llamadas cortas (< 30s), Tasa abandono / calidad
 */
export function calculateInboundAnalysis(records: CDRRecord[]): {
  totalInboundCalls: number;
  totalDurationSeconds: number;
  avgDurationSeconds: number; // TMO
  shortCalls: number;         // < 30s
  shortCallsRate: number;     // percentage
  extensionStats: InboundExtensionStats[];
  top5ExtensionsByVolume: InboundExtensionStats[];
  hourlyDistribution: { hour: number; label: string; calls: number; shortCalls: number }[];
} {
  const inboundRecords = records.filter(r => r.callType === 'Incoming');
  const totalInboundCalls = inboundRecords.length;

  if (totalInboundCalls === 0) {
    return {
      totalInboundCalls: 0,
      totalDurationSeconds: 0,
      avgDurationSeconds: 0,
      shortCalls: 0,
      shortCallsRate: 0,
      extensionStats: [],
      top5ExtensionsByVolume: [],
      hourlyDistribution: []
    };
  }

  let totalDurationSeconds = 0;
  let shortCalls = 0;

  const byExtension = new Map<string, {
    totalReceived: number;
    totalDuration: number;
    shortCalls: number;
  }>();

  const hourlyCalls = new Array(24).fill(0);
  const hourlyShort = new Array(24).fill(0);

  inboundRecords.forEach(r => {
    const dur = r.durationSeconds;
    totalDurationSeconds += dur;
    const isShort = dur < 30;
    if (isShort) shortCalls++;

    const h = r.dateTime.getHours();
    hourlyCalls[h]++;
    if (isShort) hourlyShort[h]++;

    const ext = r.to || r.agentExtension;
    if (!byExtension.has(ext)) {
      byExtension.set(ext, { totalReceived: 0, totalDuration: 0, shortCalls: 0 });
    }
    const extStat = byExtension.get(ext)!;
    extStat.totalReceived++;
    extStat.totalDuration += dur;
    if (isShort) extStat.shortCalls++;
  });

  const avgDurationSeconds = Math.round(totalDurationSeconds / totalInboundCalls);
  const shortCallsRate = parseFloat(((shortCalls / totalInboundCalls) * 100).toFixed(1));

  const extensionStats: InboundExtensionStats[] = [];
  byExtension.forEach((stats, ext) => {
    const avg = stats.totalReceived > 0 ? Math.round(stats.totalDuration / stats.totalReceived) : 0;
    const rate = stats.totalReceived > 0 ? parseFloat(((stats.shortCalls / stats.totalReceived) * 100).toFixed(1)) : 0;
    extensionStats.push({
      extension: ext,
      totalReceived: stats.totalReceived,
      totalDurationSeconds: stats.totalDuration,
      avgDurationSeconds: avg,
      shortCalls: stats.shortCalls,
      shortCallsRate: rate
    });
  });

  extensionStats.sort((a, b) => b.totalReceived - a.totalReceived);
  const top5ExtensionsByVolume = extensionStats.slice(0, 5);

  const hourlyDistribution = [];
  for (let h = 8; h <= 20; h++) {
    hourlyDistribution.push({
      hour: h,
      label: `${h}h`,
      calls: hourlyCalls[h],
      shortCalls: hourlyShort[h]
    });
  }

  return {
    totalInboundCalls,
    totalDurationSeconds,
    avgDurationSeconds,
    shortCalls,
    shortCallsRate,
    extensionStats,
    top5ExtensionsByVolume,
    hourlyDistribution
  };
}

/**
 * Generate downloadable CSV sample template (Format 1: Combined date_time)
 */
export function generateSampleCsvString(): string {
  const headers = 'date_time,duration,calltype,from,to\n';
  const rows = [
    '2026-08-19 08:05:12,180,Outgoing,3810,555102030',
    '2026-08-19 08:18:00,240,Outgoing,3810,555102031',
    '2026-08-19 08:35:00,120,Outgoing,3810,555102032',
    '2026-08-19 08:06:00,195,Incoming,555909090,4012',
    '2026-08-19 08:15:30,225,Incoming,555909091,4012',
    '2026-08-19 08:25:00,18,Incoming,555909092,4012',
    '2026-08-19 08:10:00,90,Outgoing,3812,555203040',
    '2026-08-19 08:30:00,150,Outgoing,3812,555203041',
    '2026-08-19 08:50:00,210,Outgoing,3812,555203042',
    '2026-08-19 08:12:00,180,Incoming,555808080,4055',
    '2026-08-19 08:22:00,310,Incoming,555808081,4055',
    '2026-08-19 08:45:00,45,Incoming,555808082,4055'
  ];
  return headers + rows.join('\n');
}

/**
 * Generate downloadable CSV sample template (Format 2: Separate Fecha, Hora, Origen, Destino, Duración, Tipo)
 */
export function generateSampleCampaign2CsvString(): string {
  const lines = ['"Fecha","Hora","Origen","Destino","Duración","Tipo","File"'];
  for (let day = 1; day <= 18; day++) {
    const dayStr = String(day).padStart(2, '0');
    const dateFormatted = `${dayStr} Aug 2026`;
    lines.push(`"${dateFormatted}","10:00:00","3001","987589936","00:01:20","Saliente","out-987589936-3001-202608${dayStr}-100000.wav"`);
  }
  return lines.join('\n');
}

/**
 * Analyzes the minimum and maximum real date of loaded CDR records
 * and returns the exact available dates matching the imported dataset,
 * preventing unexpected truncation.
 */
export function analyzeCDRDatasetDateRange(records: CDRRecord[]): {
  minDate: Date | null;
  maxDate: Date | null;
  availableDates: string[];
} {
  if (!records || records.length === 0) {
    return { minDate: null, maxDate: null, availableDates: [] };
  }

  let minTime = Infinity;
  let maxTime = -Infinity;
  const dateSet = new Set<string>();

  records.forEach(r => {
    if (!r.dateTime || isNaN(r.dateTime.getTime())) return;
    const t = r.dateTime.getTime();
    if (t < minTime) minTime = t;
    if (t > maxTime) maxTime = t;

    const y = r.dateTime.getFullYear();
    const m = String(r.dateTime.getMonth() + 1).padStart(2, '0');
    const d = String(r.dateTime.getDate()).padStart(2, '0');
    dateSet.add(`${y}-${m}-${d}`);
  });

  if (minTime === Infinity || maxTime === -Infinity) {
    return { minDate: null, maxDate: null, availableDates: [] };
  }

  const minDate = new Date(minTime);
  const maxDate = new Date(maxTime);

  const availableDates = Array.from(dateSet).sort();

  return {
    minDate,
    maxDate,
    availableDates
  };
}


export type ParsedForeTeesLesson = {
  lessonDate: string;
  lessonTime: string;
  instructorName: string;
  memberName: string;
  lessonType: string | null;
  foreteesLessonId: string | null;
  foreteesProId: string | null;
};

export type ParsedForeTeesLessons = {
  lessonDate: string | null;
  instructors: Array<{
    name: string;
    foreteesProId: string | null;
  }>;
  lessons: ParsedForeTeesLesson[];
};

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripTags(value: string) {
  return decodeHtml(
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]*>/g, " ")
  )
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function detectLessonDate(html: string) {
  const commentMatch = html.match(
    /<!--\s*date\s*=\s*(\d{4})(\d{2})(\d{2})\s*-->/i
  );

  if (commentMatch) {
    return `${commentMatch[1]}-${commentMatch[2]}-${commentMatch[3]}`;
  }

  const calDateMatch = html.match(
    /calDate=(\d{1,2})\/(\d{1,2})\/(\d{4})/i
  );

  if (calDateMatch) {
    const month = calDateMatch[1].padStart(2, "0");
    const day = calDateMatch[2].padStart(2, "0");
    return `${calDateMatch[3]}-${month}-${day}`;
  }

  return null;
}

function convertDisplayTimeToDatabaseTime(value: string) {
  const match = value
    .trim()
    .match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);

  if (!match) {
    return null;
  }

  let hour = Number(match[1]);
  const minute = match[2];
  const meridiem = match[3].toUpperCase();

  if (meridiem === "AM" && hour === 12) {
    hour = 0;
  } else if (meridiem === "PM" && hour !== 12) {
    hour += 12;
  }

  return `${String(hour).padStart(2, "0")}:${minute}:00`;
}

function extractProId(value: string) {
  const match = value.match(/[?&]proid=(\d+)/i);
  return match?.[1] ?? null;
}

function getClassName(attributes: string) {
  const match = attributes.match(
    /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i
  );

  return (match?.[1] ?? match?.[2] ?? match?.[3] ?? "")
    .trim()
    .toLowerCase();
}

export function parseForeTeesLessonsHtml(
  html: string
): ParsedForeTeesLessons {
  const lessonDate = detectLessonDate(html);

  const tableMatch = html.match(
    /<table\b[^>]*id\s*=\s*(?:"allpro_lesson_table"|'allpro_lesson_table')[^>]*>([\s\S]*?)<\/table>/i
  );

  if (!tableMatch) {
    return {
      lessonDate,
      instructors: [],
      lessons: [],
    };
  }

  const tableHtml = tableMatch[1];

  const rowMatches = Array.from(
    tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)
  );

  if (rowMatches.length === 0) {
    return {
      lessonDate,
      instructors: [],
      lessons: [],
    };
  }

  /*
    HEADER

    ForeTees uses:
      Time | Tom Patri | Paul Schlimm | Amy Worthington | Reserve LC

    The pro id is available in each header link:
      Proshop_lesson?proid=7&calDate=...
  */

  const headerHtml = rowMatches[0][1];

  const headers = Array.from(
    headerHtml.matchAll(/<th\b([^>]*)>([\s\S]*?)<\/th>/gi)
  );

  const instructors = headers
    .slice(1)
    .map((header) => {
      const innerHtml = header[2];
      const name = stripTags(innerHtml);

      return {
        name,
        foreteesProId: extractProId(innerHtml),
      };
    })
    .filter((instructor) => instructor.name.length > 0);

  const lessons: ParsedForeTeesLesson[] = [];

  /*
    LESSON ROWS

    Each time row has:
      td.time_col
      one td per instructor

    A real reservation is explicitly:
      <td class="booked">
        <a href="javascript:gotoTime(286227, 7, 900);">
          Eshaan Adi<br>
          Private 1 Hour Lesson
        </a>
      </td>

    We intentionally ignore:
      available
      missing
      unavailable
      lunches / blocks
  */

  for (const rowMatch of rowMatches.slice(1)) {
    const rowHtml = rowMatch[1];

    const cells = Array.from(
      rowHtml.matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi)
    );

    if (cells.length < 2) {
      continue;
    }

    const timeClass = getClassName(cells[0][1]);

    if (!timeClass.split(/\s+/).includes("time_col")) {
      continue;
    }

    const displayTime = stripTags(cells[0][2]);
    const lessonTime =
      convertDisplayTimeToDatabaseTime(displayTime);

    if (!lessonTime) {
      continue;
    }

    for (
      let instructorIndex = 0;
      instructorIndex < instructors.length;
      instructorIndex += 1
    ) {
      const cell = cells[instructorIndex + 1];

      if (!cell) {
        continue;
      }

      const cellClass = getClassName(cell[1]);

      if (!cellClass.split(/\s+/).includes("booked")) {
        continue;
      }

      const cellHtml = cell[2];

      const anchorMatch = cellHtml.match(
        /<a\b([^>]*)>([\s\S]*?)<\/a>/i
      );

      if (!anchorMatch) {
        continue;
      }

      const anchorAttributes = decodeHtml(anchorMatch[1]);
      const anchorHtml = anchorMatch[2];

      const gotoMatch = anchorAttributes.match(
        /gotoTime\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i
      );

      const parts = anchorHtml
        .split(/<br\s*\/?>/i)
        .map((part) => stripTags(part))
        .filter(Boolean);

      const memberName = parts[0] ?? "";
      const lessonType =
        parts.length > 1
          ? parts.slice(1).join(" ").trim()
          : null;

      if (!memberName) {
        continue;
      }

      const instructor =
        instructors[instructorIndex];

      lessons.push({
        lessonDate: lessonDate ?? "",
        lessonTime,
        instructorName: instructor.name,
        memberName,
        lessonType: lessonType || null,
        foreteesLessonId:
          gotoMatch?.[1] ?? null,
        foreteesProId:
          gotoMatch?.[2] ??
          instructor.foreteesProId ??
          null,
      });
    }
  }

  return {
    lessonDate,
    instructors,
    lessons,
  };
}

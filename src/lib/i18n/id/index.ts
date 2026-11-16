import { auth } from "./auth";
import { common } from "./common";
import { courses } from "./courses";
import { calendar, emails } from "./emails";
import { grades } from "./grades";
import { loose } from "./loose";
import { messages } from "./messages";
import { money } from "./money";
import { pages } from "./pages";
import { schedule } from "./schedule";
import { search } from "./search";
import { settings } from "./settings";
import { tasks } from "./tasks";
import { today } from "./today";

/** Indonesian, keyed by the English text. Split by area; later files win on a repeated key. */
export const id = {
  ...common,
  ...courses,
  ...emails,
  ...calendar,
  ...auth,
  ...grades,
  ...loose,
  ...messages,
  ...money,
  ...pages,
  ...schedule,
  ...search,
  ...settings,
  ...tasks,
  ...today,
};

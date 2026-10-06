import { say } from '@benne/script';
import { dialog, options } from './botti3-local-area.ids';

// What’s that fancy looking museum?
options.gallery.onChoose(() => {
  say`
    botti3: A gallery featuring artwork created entirely by artificial intelligence.
    botti3: Thousands of new works are produced every day.
    jensen: And not one of them means anything.
    botti3: Visitor satisfaction is very high.
    jensen: THAT ISN'T THE POINT.
  `
})

// What’s with the Authentic Human Café?
options.cafe.onChoose(() => {
  say`
    BOTTi3: A historical dining experience.
    HANK: Historical?
    BOTTi3: Customers may wait up to forty-five minutes, receive incorrect orders, and interact with visibly stressed staff.
    HANK: That's pretty accurate.
  `
})

// What's going on in that garage over there?
options.club.onChoose(() => {
  say`
    BOTTi3: The Human Driver's Club preserves traditional manual transportation.
    HANK: You mean driving.
    BOTTi3: Yes.
    HANK: You people made driving a hobby.
    BOTTi3: It already was.
  `
})

// That's all I want to know about the area for now. (Back to the BOTT-i3 choices.)
options.thatsAll.onChoose(() => {
  Botti3: "Okay!"
  dialog.end()
})

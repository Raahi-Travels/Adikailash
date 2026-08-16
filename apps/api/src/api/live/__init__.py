"""Clients for outside sources that know something about this road.

Every module here talks to a service nobody on this team controls, so they share a
posture: a failure returns nothing rather than raising, nothing is cached as fact
without a timestamp, and no source is described as authoritative when it is not.

Doc 08: "The product should not label third-party data as authoritative without
defined verification." On this route that warning has unusual teeth, because the
honest summary of a fairly exhaustive search is:

* **No source gives authoritative road status above Tawaghat.** The Uttarakhand PWD
  register covers the corridor nominally and its Gunji to Jolingkong row has one
  entry, from over a year ago.
* **No weather observation exists anywhere near here.** The nearest station reporting
  real conditions is Pantnagar, 236 m above sea level and roughly 230 km away, on the
  far side of the range. Everything we can show is model output.
* **No GLOF early warning exists.** There is an inventory of six moraine-dammed lakes
  in the Kali headwaters, four of them Risk Class A, and no feed that watches them.

So these clients are built to make a reader's confidence match ours, which mostly
means being clear about what is missing.
"""

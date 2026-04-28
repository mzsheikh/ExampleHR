Open the app in two browser windows:

Window A: employee view
Window B: manager view
The app shows both panes on the same page, so using two windows helps you see real-time-ish updates.

Seed Data
You should initially see:

Avery Johnson:

New York: 10 available, 0 pending
London: 4 available, 0 pending
Mina Patel:

Remote: 14 available, 2 pending
Manager queue:

Mina Patel request for 2 days, status Pending HCM
Scenario 1: Employee Submits Valid Request
In employee view:

Select New York.
Enter 2 days.
Choose Normal HCM.
Click Submit as pending.
Expected:

Avery New York changes from 10 available / 0 pending to 8 available / 2 pending.
Request appears as Pending HCM.
It should not say Approved.
In manager view, the new request should appear after polling or refresh.
This validates: employee gets instant feedback, but not false approval.

Scenario 2: Manager Approves Request
In manager view:

Find Avery’s pending request.
Confirm decision-time context shows the latest balance, for example 8 available, 2 pending.
Click Verify and approve.
Expected:

Request status becomes Approved.
Avery New York becomes 8 available / 0 pending.
Available days should not increase back.
Pending days should be released because the request is finalized.
This validates: manager approval re-checks balance at approval time.

Scenario 3: Manager Denies Request
Submit another Avery request for 1 day.

Expected before denial:

New York moves from 8 available / 0 pending to 7 available / 1 pending.
Then in manager view:

Click Deny.
Expected:

Request status becomes Denied.
New York returns to 8 available / 0 pending.
This validates: denial releases the held balance.

Scenario 4: Insufficient Balance
In employee view:

Select London.
Enter 20 days.
Choose Normal HCM.
Submit.
Expected:

HCM rejects the request.
London should remain 4 available / 0 pending.
No approved request should appear.
You should see a rejection/error toast.
This validates: backend prevents overspending the authoritative balance.

Scenario 5: HCM Conflict On Submit
In employee view:

Select New York.
Enter 1 day.
Choose Conflict.
Submit.
Expected:

Request is rejected.
Balance rolls back to the previous value.
No pending hold should remain.
This validates: optimistic UI rollback works.

Scenario 6: Silent Wrong HCM Success
In employee view:

Select New York.
Enter 1 day.
Choose Silent wrong.
Submit.
Expected:

Request appears as Needs review.
Balance should not decrease.
UI should warn that HCM success did not reconcile.
This validates: app does not blindly trust a success response.

Scenario 7: Anniversary Bonus Mid-Session
In employee view:

Note Avery’s New York and London balances.
Click the sparkle button in the employee panel.
Expected:

Avery’s balances increase by 1 day per location.
Versions increase.
Existing request statuses should not suddenly become approved or denied.
This validates: external HCM balance changes reconcile without surprising the workflow.

Scenario 8: Manager Approval Conflict
Submit a normal request first so it is pending.

In manager view:

Click Simulate conflict.
Expected:

Request becomes or remains Needs review.
It should not become approved.
Balance should remain consistent with the authoritative row.
This validates: manager approval is pessimistic and decision-time verified.

Scenario 9: Slow HCM
In employee view:

Select Slow HCM.
Submit a small request.
Expected:

UI immediately shows pending/working feedback.
Final balance updates after delay.
Request still ends as Pending HCM, not approved.
This validates: slow backend does not break the honest lifecycle.

Best Manual Check
For every action, check this invariant:

available + pending should move predictably
Submit pending request:

available decreases
pending increases
Approve:

available stays the same
pending decreases
Deny:

available increases back
pending decreases
Conflict/rejection:

balance returns to or remains at authoritative value
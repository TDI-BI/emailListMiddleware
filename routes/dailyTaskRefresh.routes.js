const express = require('express');
const {getAccessToken365} = require("../utils/getTokens");
const {sendEmail} = require("../utils/sendEmail");
const router = express.Router();

router.get('/dailyTaskRefresh', async (req, res) => {


    const siteUrl = 'tdibrooks.sharepoint.com';
    const sitePath = '/sites/Marine';
    const listName = "Scheduled Task"

    const accessToken = await getAccessToken365();


    const siteResponse = await fetch(
        `https://graph.microsoft.com/v1.0/sites/${siteUrl}:${sitePath}`,
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        }
    );

    const siteData = await siteResponse.json();
    const siteId = siteData.id;

    const today = new Date();

    const startOfToday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setUTCDate(startOfTomorrow.getUTCDate() + 1);

    const endDateFilter = `fields/EndDate ge '${startOfToday.toISOString()}' and fields/EndDate lt '${startOfTomorrow.toISOString()}'`;

    const TasksListFromSharepoint = await fetch(
        `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listName}/items?$expand=fields&$filter=${encodeURIComponent(endDateFilter)}`,
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                Prefer: 'HonorNonIndexedQueriesWarningMayFailRandomly',
            },
        }
    );
    const ScheduledTasksRaw = await TasksListFromSharepoint.json();
    const ScheduledTasks = ScheduledTasksRaw.value.map(e => e.fields); // these are tasks that ended today

    const TaskClassesFromSharepoint = await fetch(
        `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/Task Class/items?expand=fields`,
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        }
    );
    const TaskClassesRaw = await TaskClassesFromSharepoint.json();
    const TaskClasses = TaskClassesRaw.value.map(e => e.fields) // just a list of classes, this one is pretty short so no need to do a fancy query

    //lookup from ScheduledTask.ClassId -> TaskClasses.Years, TaskClasses.Month, TaskClasses.Id
    const classById = new Map(TaskClasses.map((c) => [String(c.id), c]));

    const addYearsMonths = (date, years, months) => {
        const result = new Date(date);
        result.setUTCFullYear(result.getUTCFullYear() + years);
        result.setUTCMonth(result.getUTCMonth() + months);
        return result;
    };

    const refreshedTasks = ScheduledTasks
        .map((scheduledTask) => {
            const taskClass = classById.get(String(scheduledTask.ClassLookupId));
            const years = taskClass?.Years ?? 0;
            const months = taskClass?.Months ?? 0;

            if (years === 0 && months === 0) return null;

            const prevStartDate = new Date(scheduledTask.StartDate);
            const prevEndDate = new Date(scheduledTask.EndDate);
            const prevDuration = prevEndDate - prevStartDate;

            const startDate = addYearsMonths(prevEndDate, years, months);
            const endDate = new Date(startDate.getTime() + prevDuration);

            return {
                ClassId: taskClass.id,
                LocationId: scheduledTask.LocationLookupId,
                StartDate: startDate.toISOString(),
                EndDate: endDate.toISOString(),
                Status: 'Automatically Scheduled'
            };
        })
        .filter(Boolean);

    const createdTasks = [];
    const failedTasks = [];

    for (const task of refreshedTasks) {
        try {
            const createResponse = await fetch(
                `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listName}/items`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        fields: {
                            ClassLookupId: task.ClassId,
                            LocationLookupId: task.LocationId,
                            StartDate: task.StartDate,
                            EndDate: task.EndDate,
                            Status: task.Status,
                        },
                    }),
                }
            );

            if (!createResponse.ok) {
                const errorBody = await createResponse.json().catch(() => ({}));
                throw new Error(`${createResponse.status}: ${JSON.stringify(errorBody)}`);
            }

            createdTasks.push(await createResponse.json());
        } catch (err) {
            failedTasks.push({task, error: err.message});
        }
    }

    const completedTasks = [];
    const failedCompletions = [];

    for (const scheduledTask of ScheduledTasks) {
        try {
            const completeResponse = await fetch(
                `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listName}/items/${scheduledTask.id}/fields`,
                {
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({Status: 'Complete'}),
                }
            );

            if (!completeResponse.ok) {
                const errorBody = await completeResponse.json().catch(() => ({}));
                throw new Error(`${completeResponse.status}: ${JSON.stringify(errorBody)}`);
            }

            completedTasks.push({id: scheduledTask.id});
        } catch (err) {
            failedCompletions.push({id: scheduledTask.id, error: err.message});
        }
    }

    res.status(200).json({
        created: createdTasks,
        failedCreations: failedTasks,
        completed: completedTasks,
        failedCompletions,
    });

});

module.exports = router;
import { people, companies } from '../neo4j/seed';

const firstUserId = people[0].id;
const secondUserId = people[1].id;
const firstCompanyId = companies[0].id;
const secondCompanyId = companies[1].id;
const thirdCompanyId = companies[2].id;

const mockJobApplications = {
  [firstUserId]: [
    {
      id: 'application1',
      applicantId: firstUserId,
      companyId: firstCompanyId,
    },
    {
      id: 'application2',
      applicantId: firstUserId,
      companyId: secondCompanyId,
    },
  ],
  [secondUserId]: [
    {
      id: 'application3',
      applicantId: secondUserId,
      companyId: thirdCompanyId,
    },
  ],
};

export default {
  Person: {
    jobApplications: parent => mockJobApplications[parent.id],
  },
  Query: {
    jobApplications: () =>
      Object.values(mockJobApplications).reduce(
        (apps, list) => [...apps, ...list],
        []
      ),
  },
};

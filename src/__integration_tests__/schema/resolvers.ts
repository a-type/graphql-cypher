const mockJobApplications = {
  a55bcb7c856850932514eed84ea60bf75a767d38: [
    {
      id: 'application1',
      applicantId: 'a55bcb7c856850932514eed84ea60bf75a767d38',
      companyId: '3c7109e9a98feb5c163669b3cff37bccb68ac16b',
    },
    {
      id: 'application2',
      applicantId: 'a55bcb7c856850932514eed84ea60bf75a767d38',
      companyId: '484ad8f4cf43b9df34eed3b51b4246359b98a062',
    },
  ],
  '898e64a2bb6fd6b306241f9136c7880a3d3399a8': [
    {
      id: 'application3',
      applicantId: '898e64a2bb6fd6b306241f9136c7880a3d3399a8',
      companyId: '762d7d9c86b477df0b1174402f8b8e0acf4286a5',
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

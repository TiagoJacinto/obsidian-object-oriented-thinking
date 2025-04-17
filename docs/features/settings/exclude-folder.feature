Feature: Exclude Folder

Scenario: Successful Exclusion
Given the following files with respective ids and file paths:
 | File Name     | Id                 | File Path            |
 | File1  			 | ExcludedFile1md    | Excluded/File1.md    |
 | File2         | ExcludedFile2md    | Excluded/File2.md    |
 | File3         | NotExcludedFile3md | NotExcluded/File3.md |
When I exclude the "Excluded" folder
Then "File1" and "File2" should be marked as soft excluded

Scenario: Removing folder from excluded folders
Given the "Excluded" folder is excluded
And the following files with respective ids and file paths:
 | File Name     | Id                 | File Path            |
 | File1  			 | ExcludedFile1md    | Excluded/File1.md    |
 | File2         | ExcludedFile2md    | Excluded/File2.md    |
 | File3         | NotExcludedFile3md | NotExcluded/File3.md |
When I remove the "Excluded" folder from excluded folders
Then I should see "File1" and "File2"
And "File1" and "File2" should not be marked as soft excluded
